import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, C, Card, ErrorBox, Field, H2, Loading, Muted } from '@/components/ui';
import { type AdminUser, createDonation, listUsers, updateDonation } from '@/lib/admin';
import { api, errorMessage, must, type Donation } from '@/lib/client';
import { parseLocalInput, toLocalInput } from '@/lib/format';
import { useUser } from '@/lib/session';

function at(daysFromToday: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, 0, 0, 0);
  return toLocalInput(d);
}

/** Create or edit a donation (ADMIN). `?id=` edits. */
export default function DonationForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const user = useUser();
  const [prev, setPrev] = useState<Donation | null>(null);
  const [drivers, setDrivers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [donorName, setDonorName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [scheduled, setScheduled] = useState(at(0, new Date().getHours() + 1));
  const [requestedContents, setRequestedContents] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const users = await listUsers();
        setDrivers(users.filter((u) => u.role === 'DRIVER' && u.enabled));
        if (id) {
          const d = must(await api().models.Donation.get({ id }));
          if (!d) throw new Error('Donación no encontrada');
          setPrev(d);
          setDonorName(d.donorName);
          setPickupAddress(d.pickupAddress);
          setScheduled(toLocalInput(new Date(d.scheduledAt)));
          setRequestedContents(d.requestedContents ?? '');
          setAdminNotes(d.adminNotes ?? '');
          setDriverId(d.driverId ?? null);
        }
      } catch (e) {
        setLoadError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const scheduledIso = parseLocalInput(scheduled);
  const errors = {
    donorName: !donorName.trim() ? 'Requerido' : null,
    pickupAddress: !pickupAddress.trim() ? 'Requerido' : null,
    scheduled: !scheduledIso ? 'Formato: AAAA-MM-DD HH:MM' : null,
  };
  const valid = !errors.donorName && !errors.pickupAddress && !errors.scheduled;

  const save = async () => {
    setSubmitted(true);
    if (!valid) return;
    setSaving(true);
    try {
      const driver = drivers.find((d) => d.sub === driverId);
      const input = {
        donorName: donorName.trim(),
        pickupAddress: pickupAddress.trim(),
        scheduledAt: scheduledIso!,
        requestedContents: requestedContents.trim() || null,
        adminNotes: adminNotes.trim() || null,
        driverId: driverId,
        driverName: driverId ? (driver?.name || driver?.email || prev?.driverName || null) : null,
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

  const lockedDriver = prev && !['REQUESTED', 'ASSIGNED'].includes(prev.status);

  return (
    <Screen>
      {loadError ? <ErrorBox text={loadError} /> : null}
      <Card>
        <H2>{prev ? 'Editar donación' : 'Nueva donación'}</H2>
        <Field
          label="Donante *"
          value={donorName}
          onChangeText={setDonorName}
          placeholder="Ej. Walmart Av. Patria"
          error={submitted ? errors.donorName : null}
        />
        <Field
          label="Dirección de recolección *"
          value={pickupAddress}
          onChangeText={setPickupAddress}
          placeholder="Calle, número, colonia, municipio"
          multiline
          error={submitted ? errors.pickupAddress : null}
          hint="Escríbela completa: el chofer la abrirá en Google Maps o Waze."
        />
        <Field
          label="Fecha y hora de recolección *"
          value={scheduled}
          onChangeText={setScheduled}
          placeholder="AAAA-MM-DD HH:MM"
          error={submitted ? errors.scheduled : null}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: -6, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            ['Hoy 12:00', at(0, 12)],
            ['Hoy 16:00', at(0, 16)],
            ['Mañana 09:00', at(1, 9)],
            ['Mañana 13:00', at(1, 13)],
          ].map(([label, value]) => (
            <Pressable key={label} onPress={() => setScheduled(value)}>
              <Text style={{ color: C.primaryDark, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="Contenido reportado por el donante (opcional)"
          value={requestedContents}
          onChangeText={setRequestedContents}
          placeholder="Lo que dijo al llamar, si aplica"
          multiline
        />
        <Field label="Notas (opcional)" value={adminNotes} onChangeText={setAdminNotes} multiline />
      </Card>

      <Card>
        <H2>Chofer asignado</H2>
        {lockedDriver ? (
          <Muted style={{ marginBottom: 8 }}>
            La donación ya fue recolectada; cambiar el chofer solo actualiza el registro.
          </Muted>
        ) : null}
        <Pressable onPress={() => setDriverId(null)} style={{ paddingVertical: 10 }}>
          <Text style={{ fontWeight: driverId === null ? '700' : '400', color: C.text }}>
            {driverId === null ? '● ' : '○ '}Sin asignar
          </Text>
        </Pressable>
        {drivers.map((d) => (
          <Pressable key={d.sub} onPress={() => setDriverId(d.sub)} style={{ paddingVertical: 10 }}>
            <Text style={{ fontWeight: driverId === d.sub ? '700' : '400', color: C.text }}>
              {driverId === d.sub ? '● ' : '○ '}
              {d.name || d.email}
            </Text>
          </Pressable>
        ))}
        {!drivers.length ? <Muted>No hay choferes activos. Créalos en Usuarios.</Muted> : null}
      </Card>

      <Button title={prev ? 'Guardar cambios' : 'Crear donación'} onPress={save} loading={saving} />
    </Screen>
  );
}
