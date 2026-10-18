import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { AppHeader } from '@/components/header';
import { Icon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { DatePicker } from '@/components/sheet';
import { Button, C, Card, ErrorBox, Loading, Muted, SectionTitle, SegmentedTabs, StatTile, Text } from '@/components/ui';
import { errorMessage, type Donation, type DonationItem } from '@/lib/client';
import { categoryLabel } from '@/lib/domain';
import { fmtDate, fmtKg } from '@/lib/format';
import { allDonations, itemsOf } from '@/lib/queries';

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '—');
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type Data = { donations: Donation[]; items: Record<string, DonationItem[]> };
type Period = 'week' | 'month' | 'prev' | 'custom';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function rangeOf(p: Period, custom: { from: Date; to: Date }): { from: Date; to: Date } {
  const now = new Date();
  if (p === 'week') {
    const from = startOfDay(now);
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); // Monday
    return { from, to: now };
  }
  if (p === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  if (p === 'prev') return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) };
  return custom;
}
/** "1 – 18 de octubre", "28 de septiembre – 4 de octubre". */
function rangeText({ from, to }: { from: Date; to: Date }) {
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return sameMonth
    ? `${from.getDate()} – ${to.getDate()} de ${MONTHS[to.getMonth()]}`
    : `${from.getDate()} de ${MONTHS[from.getMonth()]} – ${to.getDate()} de ${MONTHS[to.getMonth()]}`;
}

/** Single-series horizontal bar: values in ink, only the bar carries color. */
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '700' }}>{fmtKg(value)}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: C.neutralSoft }}>
        <View style={{ height: 10, borderRadius: 5, width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [custom, setCustom] = useState(() => ({ from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: new Date() }));
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [allCats, setAllCats] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = rangeOf(period, custom);
  const fromMs = startOfDay(range.from).getTime();
  const toMs = new Date(range.to).setHours(23, 59, 59, 999);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const donations = (await allDonations()).filter((d) => {
        const ts = new Date(d.scheduledAt).getTime();
        return d.status === 'CLOSED' && ts >= fromMs && ts <= toMs;
      });
      const items: Record<string, DonationItem[]> = {};
      for (let i = 0; i < donations.length; i += 8) {
        const batch = donations.slice(i, i + 8);
        const res = await Promise.all(batch.map((d) => itemsOf(d.id)));
        batch.forEach((d, j) => (items[d.id] = res[j]));
      }
      setData({ donations, items });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [fromMs, toMs]);

  // Recalculates whenever the period changes (no "Actualizar" button).
  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(useCallback(() => () => setPicking(null), []));

  const r = useMemo(() => {
    if (!data) return null;
    let stated = 0;
    let useful = 0;
    let discarded = 0;
    const byCategory: Record<string, number> = {};
    const byDonor: Record<string, { stated: number; useful: number; count: number }> = {};
    const byReason: Record<string, number> = {};
    for (const d of data.donations) {
      const its = data.items[d.id] ?? [];
      const st = its.filter((i) => i.stage === 'STATED').reduce((s, i) => s + i.kg, 0);
      const rv = its.filter((i) => i.stage === 'REVIEWED');
      const us = rv.reduce((s, i) => s + i.kg, 0);
      stated += st;
      useful += us;
      discarded += rv.reduce((s, i) => s + (i.discardedKg ?? 0), 0);
      const donor = (byDonor[d.donorName] ??= { stated: 0, useful: 0, count: 0 });
      donor.stated += st;
      donor.useful += us;
      donor.count += 1;
      for (const i of rv) {
        byCategory[categoryLabel(i)] = (byCategory[categoryLabel(i)] ?? 0) + i.kg;
        if (i.discardedKg) byReason[i.discardReason ?? 'Sin motivo'] = (byReason[i.discardReason ?? 'Sin motivo'] ?? 0) + i.discardedKg;
      }
    }
    const sort = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
    return {
      stated,
      useful,
      discarded,
      categories: sort(byCategory),
      donors: Object.entries(byDonor).sort((a, b) => b[1].useful - a[1].useful),
      reasons: sort(byReason),
    };
  }, [data]);

  const exportCsv = async () => {
    if (!data) return;
    // Quote every cell and neutralize spreadsheet formulas (CSV injection, MASVS-CODE-4).
    const esc = (v: unknown) => {
      let t = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
      return `"${t.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Fecha programada', 'Donante', 'Dirección', 'Chofer', 'Kg declarados', 'Kg útiles', 'Kg descartados', '% útil'],
      ...data.donations.map((d) => {
        const its = data.items[d.id] ?? [];
        const st = its.filter((i) => i.stage === 'STATED').reduce((s, i) => s + i.kg, 0);
        const rv = its.filter((i) => i.stage === 'REVIEWED');
        const us = rv.reduce((s, i) => s + i.kg, 0);
        const di = rv.reduce((s, i) => s + (i.discardedKg ?? 0), 0);
        return [fmtDate(d.scheduledAt), d.donorName, d.pickupAddress, d.driverName ?? '', st, us, di, st ? Math.round((us / st) * 100) : ''];
      }),
    ];
    await Share.share({ title: `Reporte BAMX ${rangeText(range)}`, message: rows.map((x) => x.map(esc).join(',')).join('\n') });
  };

  const maxCat = r?.categories[0]?.[1] ?? 0;
  const maxReason = r?.reasons[0]?.[1] ?? 0;
  const cats = r ? (allCats ? r.categories : r.categories.slice(0, 4)) : [];

  return (
    <Screen
      header={<AppHeader title="Reportes" subtitle="Donaciones cerradas" />}
      onRefresh={load}
      refreshing={loading && !!data}
      top={
        <>
          <SegmentedTabs
            height={44}
            value={period}
            onChange={(p) => {
              setPeriod(p);
              if (p === 'custom') setPicking('from');
            }}
            tabs={[
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mes' },
              { value: 'prev', label: 'Mes ant.' },
              { value: 'custom', label: 'Fechas' },
            ]}
          />
          {period === 'custom' ? (
            <Pressable onPress={() => setPicking('from')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }}>
              <Icon name="calendar" size={16} color={C.gray} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.gray, textDecorationLine: 'underline' }}>{rangeText(range)}</Text>
            </Pressable>
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.gray, paddingHorizontal: 2 }}>{rangeText(range)}</Text>
          )}
        </>
      }>
      {error ? <ErrorBox text={error} /> : null}
      {loading && !data ? <Loading /> : null}

      {r && data ? (
        <>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatTile big tone="white" label="Donaciones" value={String(data.donations.length)} />
              <StatTile big tone="white" label="Declarado" value={String(Math.round(r.stated))} unit="kg" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatTile big tone="green" label="Útil" value={String(Math.round(r.useful))} unit="kg" />
              <StatTile big tone="white" label="% útil" value={pct(r.useful, r.stated)} />
            </View>
          </View>

          <Card style={{ padding: 18 }}>
            <SectionTitle style={{ fontSize: 17 }}>Kg útiles por categoría</SectionTitle>
            {cats.map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={maxCat} color={C.orange} />
            ))}
            {r.categories.length > 4 ? (
              <Pressable onPress={() => setAllCats((v) => !v)} accessibilityRole="button" style={{ alignSelf: 'flex-start', height: 44, justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.gray }}>{allCats ? 'Ver menos' : `Ver todas (${r.categories.length})`}</Text>
              </Pressable>
            ) : null}
            {!r.categories.length ? <Muted>Sin datos.</Muted> : null}
          </Card>

          <Card style={{ padding: 18, gap: 4 }}>
            <SectionTitle style={{ fontSize: 17, marginBottom: 6 }}>Por donante</SectionTitle>
            {r.donors.map(([k, v], i) => (
              <View
                key={k}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  borderBottomWidth: i === r.donors.length - 1 ? 0 : 1,
                  borderBottomColor: C.divider,
                }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700' }}>{k}</Text>
                  <Text style={{ fontSize: 13, color: C.gray }}>
                    {v.count} {v.count === 1 ? 'donación' : 'donaciones'} · {fmtKg(v.useful)} útiles
                  </Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800' }}>{pct(v.useful, v.stated)} útil</Text>
              </View>
            ))}
            {!r.donors.length ? <Muted>Sin datos.</Muted> : null}
          </Card>

          <Card style={{ padding: 18 }}>
            <SectionTitle style={{ fontSize: 17 }}>Motivos de descarte</SectionTitle>
            {r.reasons.map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={maxReason} color={C.red} />
            ))}
            {!r.reasons.length ? <Muted>No hubo descartes.</Muted> : null}
          </Card>

          <Card style={{ padding: 18, gap: 4 }}>
            <SectionTitle style={{ fontSize: 17, marginBottom: 6 }}>Detalle por donación</SectionTitle>
            {data.donations.map((d, i) => {
              const its = data.items[d.id] ?? [];
              const st = its.filter((x) => x.stage === 'STATED').reduce((s, x) => s + x.kg, 0);
              const us = its.filter((x) => x.stage === 'REVIEWED').reduce((s, x) => s + x.kg, 0);
              return (
                <Pressable
                  key={d.id}
                  onPress={() => router.push({ pathname: '/donation/[id]', params: { id: d.id } })}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    minHeight: 56,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderBottomWidth: i === data.donations.length - 1 ? 0 : 1,
                    borderBottomColor: C.divider,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700' }}>{d.donorName}</Text>
                    <Text style={{ fontSize: 13, color: C.gray }}>
                      {fmtDate(d.scheduledAt)} · {fmtKg(us)} de {fmtKg(st)} · {pct(us, st)}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={C.gray} />
                </Pressable>
              );
            })}
            {!data.donations.length ? <Muted>No hay donaciones cerradas en este periodo.</Muted> : null}
          </Card>

          <Button kind="secondary" icon="download" title="Exportar CSV" onPress={exportCsv} disabled={!data.donations.length} />
        </>
      ) : null}

      <DatePicker
        key={picking ?? 'closed'}
        visible={picking !== null}
        title={picking === 'to' ? 'Hasta' : 'Desde'}
        value={picking === 'to' ? custom.to : custom.from}
        minimumDate={picking === 'to' ? custom.from : undefined}
        onClose={() => setPicking(null)}
        onConfirm={(d) => {
          if (picking === 'from') {
            setCustom((c) => ({ from: d, to: c.to < d ? d : c.to }));
            setPicking('to'); // then ask the end date
          } else {
            setCustom((c) => ({ ...c, to: d }));
            setPicking(null);
          }
        }}
      />
    </Screen>
  );
}
