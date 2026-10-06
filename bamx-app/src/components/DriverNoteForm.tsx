import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export type DeliveryNote = {
  assigned_number: string;
  delivery_date: string;
  pickup_location: string;
  food: string;
  route_number: number;
  quantity_kg: number;
  product_type: string;
  operator_name: string;
  signature: string | null;
};

type SupabaseInsertClient = {
  from: (table: "delivery_notes") => {
    insert: (
      values: DeliveryNote,
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

type DriverNoteFormProps = {
  /** Cliente Supabase v2 ya configurado por la aplicación. */
  supabase: SupabaseInsertClient;
  onSubmitted?: (note: DeliveryNote) => void;
};

const makeAssignedNumber = () => `ENT-${Date.now()}`;
const formatDate = (date: Date) => date.toLocaleDateString("es-MX");
const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function DriverNoteForm({
  supabase,
  onSubmitted,
}: DriverNoteFormProps) {
  const [assignedNumber] = useState(makeAssignedNumber);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickupLocation, setPickupLocation] = useState("");
  const [food, setFood] = useState("");
  const [routeNumber, setRouteNumber] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [productType, setProductType] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) setDate(selectedDate);
  };

  const onSubmit = async () => {
    const missing = [
      ["Lugar de recogida", pickupLocation],
      ["Alimento", food],
      ["No. de ruta", routeNumber],
      ["Cantidad en KG", quantityKg],
      ["Tipo de producto", productType],
      ["Nombre del operador", operatorName],
    ]
      .filter(([, value]) => !String(value).trim())
      .map(([label]) => label);

    setErrors(missing);
    if (missing.length) {
      Alert.alert("Revisa el formulario", `Completa: ${missing.join(", ")}.`);
      return;
    }

    const note: DeliveryNote = {
      assigned_number: assignedNumber,
      delivery_date: toLocalIsoDate(date),
      pickup_location: pickupLocation.trim(),
      food: food.trim(),
      route_number: Number(routeNumber),
      quantity_kg: Number(quantityKg),
      product_type: productType.trim(),
      operator_name: operatorName.trim(),
      signature,
    };

    if (
      !Number.isFinite(note.route_number) ||
      !Number.isFinite(note.quantity_kg) ||
      note.quantity_kg <= 0
    ) {
      Alert.alert(
        "Datos numéricos inválidos",
        "La ruta debe ser un número y la cantidad debe ser mayor que cero.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("delivery_notes").insert(note);
      if (error) throw new Error(error.message);
      setErrors([]);
      onSubmitted?.(note);
      Alert.alert(
        "Nota guardada",
        "La nota de entrega se registró correctamente.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar la nota.";
      Alert.alert("Error al guardar", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    options: {
      keyboardType?: "default" | "numeric";
      placeholder?: string;
    } = {},
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={options.placeholder ?? `Ingresa ${label.toLowerCase()}`}
        placeholderTextColor="#77818B"
        keyboardType={options.keyboardType ?? "default"}
        style={[styles.input, errors.includes(label) && styles.inputError]}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Nota de entrega</Text>
        <Text style={styles.subtitle}>
          Completa los datos de la recolección.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Número asignado</Text>
          <Text
            accessibilityLabel="Número asignado"
            style={[styles.input, styles.readOnly]}
          >
            {assignedNumber}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Fecha</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Seleccionar fecha"
            onPress={() => setShowDatePicker(true)}
            style={styles.input}
          >
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}
        </View>

        {field("Lugar de recogida", pickupLocation, setPickupLocation)}
        {field("Alimento", food, setFood)}
        {field("No. de ruta", routeNumber, setRouteNumber, {
          keyboardType: "numeric",
        })}
        {field("Cantidad en KG", quantityKg, setQuantityKg, {
          keyboardType: "numeric",
        })}
        {field("Tipo de producto", productType, setProductType)}
        {field("Nombre del operador", operatorName, setOperatorName)}

        <View style={styles.field}>
          <Text style={styles.label}>Firma digital</Text>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureText}>
              {signature
                ? "Firma capturada"
                : "Espacio preparado para integrar la captura de firma"}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitPressed,
            isSubmitting && styles.disabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Guardar nota</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 40,
  },
  title: { color: "#17212B", fontSize: 26, fontWeight: "700", marginBottom: 6 },
  subtitle: { color: "#5B6672", fontSize: 15, marginBottom: 22 },
  field: { marginBottom: 16 },
  label: { color: "#263544", fontSize: 14, fontWeight: "600", marginBottom: 7 },
  input: {
    minHeight: 48,
    borderColor: "#D5DCE3",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: "#17212B",
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  inputError: { borderColor: "#C62828" },
  readOnly: {
    overflow: "hidden",
    backgroundColor: "#F2F5F7",
    textAlignVertical: "center",
  },
  dateText: { color: "#17212B", fontSize: 16 },
  signatureBox: {
    minHeight: 112,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#9AA6B2",
    borderRadius: 10,
    backgroundColor: "#FAFBFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  signatureText: { color: "#687583", fontSize: 14, textAlign: "center" },
  submitButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: "#146B52",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitPressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
