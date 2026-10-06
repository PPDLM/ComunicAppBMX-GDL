import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';

import { photoUrl } from '@/lib/queries';
import { Button, C, Muted } from './ui';

async function pick(fromCamera: boolean): Promise<string | null> {
  const perm = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permiso requerido', fromCamera ? 'Permite el acceso a la cámara.' : 'Permite el acceso a tus fotos.');
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5 };
  const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  return res.canceled ? null : res.assets[0].uri;
}

/** Take or choose one photo. */
export function PhotoField({
  label,
  hint,
  uri,
  onChange,
  required,
}: {
  label: string;
  hint?: string;
  uri: string | null;
  onChange: (uri: string | null) => void;
  required?: boolean;
}) {
  const choose = () =>
    Alert.alert(label, undefined, [
      { text: 'Tomar foto', onPress: async () => onChange((await pick(true)) ?? uri) },
      { text: 'Elegir de galería', onPress: async () => onChange((await pick(false)) ?? uri) },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontWeight: '600', marginBottom: 6, color: C.text }}>
        {label}
        {required ? <Text style={{ color: C.danger }}> *</Text> : null}
      </Text>
      {hint ? <Muted style={{ marginBottom: 6 }}>{hint}</Muted> : null}
      {uri ? (
        <View>
          <Image source={{ uri }} style={{ width: '100%', height: 200, borderRadius: 10, backgroundColor: '#E5E7EB' }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button kind="secondary" title="Cambiar" onPress={choose} style={{ flex: 1 }} />
            <Button kind="ghost" title="Quitar" onPress={() => onChange(null)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button kind="secondary" title="📷 Agregar foto" onPress={choose} />
      )}
    </View>
  );
}

/** Multiple optional photos. */
export function PhotoList({ uris, onChange, max = 5 }: { uris: string[]; onChange: (u: string[]) => void; max?: number }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontWeight: '600', marginBottom: 6, color: C.text }}>Otras fotos (opcional)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {uris.map((u, i) => (
          <Pressable
            key={u + i}
            onLongPress={() => onChange(uris.filter((_, j) => j !== i))}
            accessibilityHint="Mantén presionado para quitar">
            <Image source={{ uri: u }} style={{ width: 90, height: 90, borderRadius: 8 }} />
          </Pressable>
        ))}
      </View>
      {uris.length ? <Muted>Mantén presionada una foto para quitarla.</Muted> : null}
      {uris.length < max ? (
        <Button
          kind="secondary"
          title="📷 Agregar otra foto"
          onPress={async () => {
            const u = await pick(true);
            if (u) onChange([...uris, u]);
          }}
        />
      ) : null}
    </View>
  );
}

/** Shows a photo stored in S3 (signed URL). */
export function RemotePhoto({ path, label }: { path: string; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    photoUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path]);
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={{ fontWeight: '600', marginBottom: 6 }}>{label}</Text> : null}
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: 220, borderRadius: 10, backgroundColor: '#E5E7EB' }} resizeMode="contain" />
      ) : failed ? (
        <Muted>No se pudo cargar la foto (¿sin conexión?).</Muted>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}
