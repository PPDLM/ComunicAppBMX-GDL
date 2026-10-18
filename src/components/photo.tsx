import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { photoUrl } from '@/lib/queries';
import { Icon } from './icons';
import { C, IconButton, Muted, Text } from './ui';

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

/**
 * Square photo tile (pickup note). Empty → camera opens directly (long-press: gallery).
 * With a photo → Cambiar / Quitar.
 */
export function PhotoTile({
  label,
  uri,
  onChange,
  required,
}: {
  label: string;
  uri: string | null;
  onChange: (uri: string | null) => void;
  required?: boolean;
}) {
  const take = async () => {
    const u = await pick(true);
    if (u) onChange(u);
  };
  const fromGallery = async () => {
    const u = await pick(false);
    if (u) onChange(u);
  };
  const onPress = () => {
    if (!uri) return void take();
    Alert.alert(label, undefined, [
      { text: 'Cambiar (cámara)', onPress: () => void take() },
      { text: 'Elegir de galería', onPress: () => void fromGallery() },
      { text: 'Quitar', style: 'destructive', onPress: () => onChange(null) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };
  const done = !!uri;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={!uri ? () => void fromGallery() : undefined}
      accessibilityRole="button"
      accessibilityLabel={done ? `Foto de ${label}, tomada. Cambiar` : `Tomar foto: ${label}`}
      accessibilityHint={!uri ? 'Mantén presionado para elegir de la galería' : undefined}
      style={({ pressed }) => ({
        flex: 1,
        aspectRatio: 1,
        borderRadius: 14,
        borderWidth: 2,
        borderStyle: done ? 'solid' : 'dashed',
        borderColor: done ? C.green : required ? C.red : C.dashed,
        backgroundColor: done ? C.greenSoft : '#FFFFFF',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 6,
        opacity: pressed ? 0.8 : 1,
      })}>
      {done ? (
        <>
          <Image source={{ uri }} style={{ position: 'absolute', inset: 0, opacity: 0.35 }} contentFit="cover" />
          <Icon name="check" size={28} color={C.greenText} strokeWidth={2.6} />
        </>
      ) : (
        <Icon name="camera" size={28} color={required ? C.red : C.ink} />
      )}
      <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center', color: done ? C.greenText : required ? C.redText : C.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Up to `max` extra photos: a tile per photo plus one "Otra foto" tile. */
export function extraPhotoTiles(uris: string[], onChange: (u: string[]) => void, max = 5) {
  const tiles = uris.map((u, i) => (
    <PhotoTile
      key={u + i}
      label={`Foto ${i + 1}`}
      uri={u}
      onChange={(n) => onChange(n ? uris.map((x, j) => (j === i ? n : x)) : uris.filter((_, j) => j !== i))}
    />
  ));
  if (uris.length < max) {
    tiles.push(<PhotoTile key="add" label="Otra foto" uri={null} onChange={(n) => n && onChange([...uris, n])} />);
  }
  return tiles;
}

function useSignedUrl(path: string) {
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
  return { url, failed };
}

/** S3 photos as 3-column thumbnails; tap = full screen. */
export function PhotoGrid({ photos }: { photos: { path: string; label: string }[] }) {
  const [open, setOpen] = useState<{ path: string; label: string } | null>(null);
  const rows: (typeof photos)[] = [];
  photos.forEach((p, i) => (i % 3 ? rows[rows.length - 1].push(p) : rows.push([p])));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((p) => (
            <Thumb key={p.path} {...p} onPress={() => setOpen(p)} />
          ))}
          {Array.from({ length: 3 - row.length }, (_, i) => (
            <View key={i} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
      <Viewer photo={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function Thumb({ path, label, onPress }: { path: string; label: string; onPress: () => void }) {
  const { url, failed } = useSignedUrl(path);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Ver foto: ${label}`}
      style={{ flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: '#EDEDED', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {url ? (
        // Signed URLs change on every request; key the disk cache by the S3 path instead.
        <Image source={{ uri: url, cacheKey: path }} cachePolicy="memory-disk" style={{ position: 'absolute', inset: 0 }} contentFit="cover" transition={150} />
      ) : failed ? null : (
        <ActivityIndicator color={C.red} />
      )}
      <View style={{ position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.gray }}>{label}</Text>
      </View>
    </Pressable>
  );
}

function Viewer({ photo, onClose }: { photo: { path: string; label: string } | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!photo} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {photo ? <FullImage path={photo.path} /> : null}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton round icon="x" color={C.ink} label="Cerrar foto" onPress={onClose} style={{ borderRadius: 24 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>{photo?.label}</Text>
        </View>
      </View>
    </Modal>
  );
}

function FullImage({ path }: { path: string }) {
  const { url, failed } = useSignedUrl(path);
  if (failed) return <Muted style={{ color: '#FFFFFF', margin: 80, textAlign: 'center' }}>No se pudo cargar la foto (¿sin conexión?).</Muted>;
  if (!url) return <ActivityIndicator color="#FFFFFF" style={{ flex: 1 }} />;
  return <Image source={{ uri: url, cacheKey: path }} cachePolicy="memory-disk" style={{ flex: 1 }} contentFit="contain" />;
}
