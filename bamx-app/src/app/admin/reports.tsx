import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, C, Card, ErrorBox, Field, H2, Loading, Muted, Row } from '@/components/ui';
import { errorMessage, type Donation, type DonationItem } from '@/lib/client';
import { categoryLabel } from '@/lib/domain';
import { fmtDate, fmtKg, parseDateOnly } from '@/lib/format';
import { allDonations, itemsOf } from '@/lib/queries';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '—');

type Data = { donations: Donation[]; items: Record<string, DonationItem[]> };

function Bar({ label, value, max, extra }: { label: string; value: number; max: number; extra?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, flex: 1 }}>{label}</Text>
        <Text style={{ color: C.text, fontWeight: '600' }}>
          {fmtKg(value)}
          {extra ? ` · ${extra}` : ''}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: '#EEF0EA', borderRadius: 4, marginTop: 4 }}>
        <View
          style={{ height: 8, width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, backgroundColor: C.primary, borderRadius: 4 }}
        />
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const now = new Date();
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(now));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const f = parseDateOnly(from);
    const t = parseDateOnly(to);
    if (!f || !t) {
      setError('Usa el formato AAAA-MM-DD en ambas fechas.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const start = new Date(`${f}T00:00:00`).getTime();
      const end = new Date(`${t}T23:59:59`).getTime();
      const donations = (await allDonations()).filter((d) => {
        const ts = new Date(d.scheduledAt).getTime();
        return d.status === 'CLOSED' && ts >= start && ts <= end;
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
  }, [from, to]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = useMemo(() => {
    if (!data) return null;
    let stated = 0;
    let useful = 0;
    let discarded = 0;
    const byCategory: Record<string, { useful: number; discarded: number }> = {};
    const byDonor: Record<string, { stated: number; useful: number; count: number }> = {};
    const byReason: Record<string, number> = {};
    for (const d of data.donations) {
      const its = data.items[d.id] ?? [];
      const st = its.filter((i) => i.stage === 'STATED').reduce((s, i) => s + i.kg, 0);
      const rv = its.filter((i) => i.stage === 'REVIEWED');
      const us = rv.reduce((s, i) => s + i.kg, 0);
      const di = rv.reduce((s, i) => s + (i.discardedKg ?? 0), 0);
      stated += st;
      useful += us;
      discarded += di;
      const donor = (byDonor[d.donorName] ??= { stated: 0, useful: 0, count: 0 });
      donor.stated += st;
      donor.useful += us;
      donor.count += 1;
      for (const i of rv) {
        const c = (byCategory[categoryLabel(i)] ??= { useful: 0, discarded: 0 });
        c.useful += i.kg;
        c.discarded += i.discardedKg ?? 0;
        if (i.discardedKg) byReason[i.discardReason ?? 'Sin motivo'] = (byReason[i.discardReason ?? 'Sin motivo'] ?? 0) + i.discardedKg;
      }
    }
    return { stated, useful, discarded, byCategory, byDonor, byReason };
  }, [data]);

  const exportCsv = async () => {
    if (!data) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
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
    await Share.share({ title: `Reporte BAMX ${from} a ${to}`, message: rows.map((r) => r.map(esc).join(',')).join('\n') });
  };

  const maxCat = r ? Math.max(0, ...Object.values(r.byCategory).map((c) => c.useful)) : 0;
  const maxDonor = r ? Math.max(0, ...Object.values(r.byDonor).map((c) => c.useful)) : 0;
  const maxReason = r ? Math.max(0, ...Object.values(r.byReason)) : 0;

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <Card>
        <H2>Periodo (donaciones cerradas)</H2>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Desde" value={from} onChangeText={setFrom} placeholder="AAAA-MM-DD" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Hasta" value={to} onChangeText={setTo} placeholder="AAAA-MM-DD" />
          </View>
        </View>
        <Button title="Actualizar" onPress={load} loading={loading} />
      </Card>

      {error ? <ErrorBox text={error} /> : null}
      {loading && !data ? <Loading /> : null}

      {r && data ? (
        <>
          <Card>
            <H2>Totales</H2>
            <Row label="Donaciones" value={String(data.donations.length)} />
            <Row label="Declarado" value={fmtKg(r.stated)} />
            <Row label="Útil" value={fmtKg(r.useful)} />
            <Row label="Descartado" value={fmtKg(r.discarded)} />
            <Row label="% útil" value={pct(r.useful, r.stated)} />
            <Muted style={{ marginTop: 6 }}>
              "Declarado" es lo que el chofer registró al recoger; "útil" es lo que inspección aprobó.
            </Muted>
          </Card>

          <Card>
            <H2>Kg útiles por categoría</H2>
            {Object.entries(r.byCategory)
              .sort((a, b) => b[1].useful - a[1].useful)
              .map(([k, v]) => (
                <Bar key={k} label={k} value={v.useful} max={maxCat} extra={v.discarded ? `${fmtKg(v.discarded)} desc.` : undefined} />
              ))}
            {!Object.keys(r.byCategory).length ? <Muted>Sin datos.</Muted> : null}
          </Card>

          <Card>
            <H2>Por donante</H2>
            {Object.entries(r.byDonor)
              .sort((a, b) => b[1].useful - a[1].useful)
              .map(([k, v]) => (
                <Bar key={k} label={`${k} (${v.count})`} value={v.useful} max={maxDonor} extra={`${pct(v.useful, v.stated)} útil`} />
              ))}
            {!Object.keys(r.byDonor).length ? <Muted>Sin datos.</Muted> : null}
          </Card>

          <Card>
            <H2>Motivos de descarte</H2>
            {Object.entries(r.byReason)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <Bar key={k} label={k} value={v} max={maxReason} />
              ))}
            {!Object.keys(r.byReason).length ? <Muted>No hubo descartes.</Muted> : null}
          </Card>

          <Card>
            <H2>Detalle por donación</H2>
            {data.donations.map((d) => {
              const its = data.items[d.id] ?? [];
              const st = its.filter((i) => i.stage === 'STATED').reduce((s, i) => s + i.kg, 0);
              const us = its.filter((i) => i.stage === 'REVIEWED').reduce((s, i) => s + i.kg, 0);
              return (
                <Pressable
                  key={d.id}
                  onPress={() => router.push({ pathname: '/donation/[id]', params: { id: d.id } })}
                  style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF0EA' }}>
                  <Text style={{ fontWeight: '600', color: C.text }}>{d.donorName}</Text>
                  <Muted>
                    {fmtDate(d.scheduledAt)} · declarado {fmtKg(st)} · útil {fmtKg(us)} · {pct(us, st)}
                  </Muted>
                </Pressable>
              );
            })}
            {!data.donations.length ? <Muted>No hay donaciones cerradas en este periodo.</Muted> : null}
          </Card>

          <Button kind="secondary" title="Exportar CSV (compartir)" onPress={exportCsv} disabled={!data.donations.length} />
        </>
      ) : null}
    </Screen>
  );
}
