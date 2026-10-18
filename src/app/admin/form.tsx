import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { DatePicker } from '@/components/sheet';
import { Button, C, Card, ChoiceGrid, ErrorBox, Field, InlineError, Label, Loading, Muted, Text, Title } from '@/components/ui';
import { type AdminUser, createDonation, listUsers, updateDonation } from '@/lib/admin';
import { api, errorMessage, must, type Donation } from '@/lib/client';
import { MAX, cleanText, isToday, parseLocalInput, toLocalInput } from '@/lib/format';
import { cacheGet } from '@/lib/offline';
import { useUser } from '@/lib/session';

const HOURS = ['09:00', '12:00', '16:00'] as const;
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pad = (n: number) => String(n).padStart(2, '0');

type Day = 'today' | 'tomorrow' | 'other';
type Hour = (typeof HOURS)[number] | 'other';

function dayOf(d: Date): Day {
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return 'today';
  t.setDate(t.getDate() + 1);
  return d.toDateString() === t.toDateString() ? 'tomorrow' : 'other';
}
function hourOf(d: Date): Hour {
  const h = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return (HOURS as readonly string[]).includes(h) ? (h as Hour) : 'other';
}
/** Next round hour from now (default for new donations). */
function nextRoundHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

/** Create or edit a donation (ADMIN). `?id=` edits; `?focus=driver` jumps to the driver section. */
export default function DonationForm() {
  const { id, focus } = useLocalSearchParams<{ id?: string; focus?: string }>();
  const user = useUser();
  const scrollRef = useRef<ScrollView>(null);
  const driverY = useRef(0);
  const [prev, setPrev] = useState<Donation | null>(null);
  const [drivers, setDrivers] = useState<AdminUser[]>([]);
  const [cached, setCached] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [donorName, setDonorName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [when, setWhen] = useState<Date>(nextRoundHour());
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [requestedContents, setRequestedContents] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [users, cache] = await Promise.all([listUsers(), cacheGet<Donation[]>('admin:donations')]);
        setDrivers(users.filter((u) => u.role === 'DRIVER' && u.enabled));
        setCached(cache?.data ?? []);
        if (id) {
          const d = must(await api().models.Donation.get({ id }));
          if (!d) throw new Error('Donación no encontrada');
          setPrev(d);
          setDonorName(d.donorName);
          setPickupAddress(d.pickupAddress);
          setWhen(new Date(d.scheduledAt));
          setRequestedContents(d.requestedContents ?? '');
          setAdminNotes(d.adminNotes ?? '');
          setNotesOpen(!!d.adminNotes);
          setDriverId(d.driverId ?? null);
        }
      } catch (e) {
        setLoadError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // "Asignar chofer" from the list: scroll straight to the driver section.
  useEffect(() => {
    if (!loading && focus === 'driver') {
      const t = setTimeout(() => scrollRef.current?.scrollTo({ y: driverY.current, animated: true }), 250);
      return () => clearTimeout(t);
    }
  }, [loading, focus]);

  const scheduled = toLocalInput(when);
  const scheduledIso = parseLocalInput(scheduled);
  const errors = {
    donorName: !cleanText(donorName) ? 'Escribe el nombre del donante' : null,
    pickupAddress: !cleanText(pickupAddress, MAX.address) ? 'Escribe la dirección completa' : null,
    scheduled: !scheduledIso ? 'Elige día y hora' : null,
  };
  const valid = !errors.donorName && !errors.pickupAddress && !errors.scheduled;

  const save = async () => {
    setSubmitted(true);
    if (!valid) return;
    setSaving(true);
    try {
      const driver = drivers.find((d) => d.sub === driverId);
      const input = {
        donorName: cleanText(donorName, MAX.short),
        pickupAddress: cleanText(pickupAddress, MAX.address),
        scheduledAt: scheduledIso!,
        requestedContents: cleanText(requestedContents, MAX.long) || null,
        adminNotes: cleanText(adminNotes, MAX.long) || null,
        driverId: driverId,
        driverName: driverId ? driver?.name || driver?.email || prev?.driverName || null : null,
      };
      if (prev) await updateDonation(prev, input, user);
      else await createDonation(input, user);
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  // Last distinct donors (fill the address too).
  const recent: { name: string; address: string }[] = [];
  for (const d of [...cached].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))) {
    if (recent.length >= 5) break;
    if (!recent.some((r) => r.name === d.donorName)) recent.push({ name: d.donorName, address: d.pickupAddress });
  }
  const loadToday = (sub: string) =>
    cached.filter((d) => d.driverId === sub && d.status === 'ASSIGNED' && isToday(d.scheduledAt)).length;

  const setDay = (day: Day) => {
    if (day === 'other') return setPicker('date');
    const d = new Date();
    if (day === 'tomorrow') d.setDate(d.getDate() + 1);
    const n = new Date(when);
    n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setWhen(n);
  };
  const setHour = (h: Hour) => {
    if (h === 'other') return setPicker('time');
    const [hh, mm] = h.split(':').map(Number);
    const n = new Date(when);
    n.setHours(hh, mm, 0, 0);
    setWhen(n);
  };
  const lockedDriver = prev && !['REQUESTED', 'ASSIGNED'].includes(prev.status);
  const day = dayOf(when);
  const hour = hourOf(when);

  return (
    <Screen
      scrollRef={scrollRef}
      footer={
        <Button size="lg" icon="check" title={prev ? 'Guardar cambios' : 'Crear donación'} onPress={save} loading={saving} />
      }>
      <Title style={{ paddingHorizontal: 2 }}>{prev ? 'Editar donación' : 'Nueva donación'}</Title>
      {loadError ? <ErrorBox text={loadError} /> : null}

      <Card style={{ padding: 18, gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Field
            label="Donante"
            maxLength={MAX.short}
            value={donorName}
            onChangeText={setDonorName}
            placeholder="Ej. Walmart Av. Patria"
            error={submitted ? errors.donorName : null}
          />
          {!prev && recent.length ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.gray }}>Donantes recientes (llenan la dirección):</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {recent.map((r) => (
                  <Pressable
                    key={r.name}
                    onPress={() => {
                      setDonorName(r.name);
                      setPickupAddress(r.address);
                    }}
                    accessibilityRole="button"
                    style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: C.borderStrong, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>{r.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>
        <Field
          label="Dirección de recolección"
          maxLength={MAX.address}
          value={pickupAddress}
          onChangeText={setPickupAddress}
          placeholder="Calle, número, colonia, municipio"
          multiline
          error={submitted ? errors.pickupAddress : null}
          hint="Escríbela completa: el chofer la abrirá en Google Maps o Waze."
        />
      </Card>

      <Card style={{ padding: 18 }}>
        <Label>¿Cuándo?</Label>
        <ChoiceGrid<Day>
          label="Día"
          columns={3}
          value={day}
          onChange={setDay}
          options={[
            { value: 'today', label: 'Hoy' },
            { value: 'tomorrow', label: 'Mañana' },
            { value: 'other', label: 'Otro día' },
          ]}
        />
        <ChoiceGrid<Hour>
          label="Hora"
          columns={4}
          height={48}
          value={hour}
          onChange={setHour}
          options={[...HOURS.map((h) => ({ value: h, label: h })), { value: 'other' as const, label: hour === 'other' ? `${pad(when.getHours())}:${pad(when.getMinutes())}` : 'Otra' }]}
        />
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.gray }}>
          {DAYS[when.getDay()]} {when.getDate()} {MONTHS[when.getMonth()]}, {pad(when.getHours())}:{pad(when.getMinutes())}
        </Text>
        {submitted && errors.scheduled ? <InlineError text={errors.scheduled} /> : null}
      </Card>

      <View onLayout={(e) => (driverY.current = e.nativeEvent.layout.y)}>
        <Card style={{ padding: 18, gap: 10 }}>
          <Label>Chofer</Label>
          {lockedDriver ? (
            <Muted style={{ fontSize: 14 }}>La donación ya fue recolectada; cambiar el chofer solo actualiza el registro.</Muted>
          ) : null}
          <View accessibilityRole="radiogroup" accessibilityLabel="Chofer" style={{ gap: 8 }}>
            {drivers.map((d) => {
              const on = driverId === d.sub;
              const n = loadToday(d.sub);
              return (
                <Pressable
                  key={d.sub}
                  onPress={() => setDriverId(d.sub)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={{
                    minHeight: 60,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    borderWidth: on ? 2 : 1.5,
                    borderColor: on ? C.orange : C.border,
                    backgroundColor: on ? C.orangeSoft : '#FFFFFF',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: on ? 7 : 2,
                      borderColor: on ? C.orange : '#BDBDBD',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: on ? '700' : '600' }}>{d.name || d.email}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: on ? C.orangeText : C.gray }}>{n ? `${n} hoy` : 'Libre'}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setDriverId(null)}
              accessibilityRole="radio"
              accessibilityState={{ checked: driverId === null }}
              style={{
                minHeight: 52,
                paddingHorizontal: 16,
                borderRadius: 14,
                borderWidth: driverId === null ? 2 : 1.5,
                borderStyle: driverId === null ? 'solid' : 'dashed',
                borderColor: driverId === null ? C.orange : C.borderStrong,
                backgroundColor: driverId === null ? C.orangeSoft : '#FFFFFF',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: driverId === null ? C.orangeText : C.gray }}>Asignar después</Text>
            </Pressable>
          </View>
          {!drivers.length ? <Muted style={{ fontSize: 14 }}>No hay choferes activos. Créalos en Usuarios.</Muted> : null}
        </Card>
      </View>

      <Card style={{ padding: 18, gap: 8 }}>
        <Field
          label="Lo que dijo el donante"
          optional
          maxLength={MAX.long}
          value={requestedContents}
          onChangeText={setRequestedContents}
          placeholder="Ej. pan del día y abarrotes"
          multiline
        />
        {notesOpen ? (
          <Field label="Nota para el chofer" optional maxLength={MAX.long} value={adminNotes} onChangeText={setAdminNotes} multiline autoFocus={!prev} />
        ) : (
          <Pressable onPress={() => setNotesOpen(true)} accessibilityRole="button" style={{ alignSelf: 'flex-start', height: 44, justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.gray }}>+ Nota para el chofer</Text>
          </Pressable>
        )}
      </Card>

      <DatePicker
        visible={picker !== null}
        mode={picker ?? 'date'}
        title={picker === 'time' ? 'Hora de recolección' : 'Día de recolección'}
        value={when}
        minimumDate={picker === 'date' ? new Date() : undefined}
        onClose={() => setPicker(null)}
        onConfirm={(d) => {
          const n = new Date(when);
          if (picker === 'date') n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
          else n.setHours(d.getHours(), d.getMinutes(), 0, 0);
          setWhen(n);
          setPicker(null);
        }}
      />
    </Screen>
  );
}
