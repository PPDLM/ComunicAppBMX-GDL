import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";

export default function FormularioRecepcion() {
    const [producto, setProducto] = useState("");
    const [cantidad, setCantidad] = useState("");
    const [unidad, setUnidad] = useState("");
    const [procedencia, setProcedencia] = useState("");
    const [Numero_asignado, setNum_Asing] = useState("");
    const [Fecha, setFecha] = useState("");
    const [Nombre, setNombre] = useState("");
    const [procedenci, setProcedenci] = useState("");


  const enviarFormulario = () => {
    if (!producto || !cantidad || !unidad || !procedencia) {
      Alert.alert("Error", "Por favor llena todos los campos");
      return;
    }

    console.log({
      producto,
      cantidad,
      unidad,
      procedencia,
    });

    Alert.alert("Éxito", "Información registrada correctamente");

    setProducto("");
    setCantidad("");
    setUnidad("");
    setProcedencia("");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>El pepe</Text>

      <Text style={styles.subtitulo}>
        Ingresa la información del producto recibido
      </Text>

      <View style={styles.formulario}>
        
        <Text style={styles.label}>No. Asignado</Text>
    
        <TextInput
          style={styles.input}
          placeholder="Ej. 01"
          value={producto}
          onChangeText={setProducto}
        />

        <Text style={styles.label}>Lugar donde se va a recoger</Text>

        <TextInput
          style={styles.input}
          placeholder="Ej. Walmart"
          value={procedencia}
          onChangeText={setProcedencia}
        />


        <Text style={styles.label}>Productos</Text>
    
        <TextInput
          style={styles.input}
          placeholder="Ej. Arroz"
          value={producto}
          onChangeText={setProducto}
        />

        <Text style={styles.label}>No. de ruta</Text>
    
        <TextInput
          style={styles.input}
          placeholder="Ej. Av. Mexico"
          value={producto}
          onChangeText={setProducto}
        />

        <Text style={styles.label}>Cantidad</Text>

        <TextInput
          style={styles.input}
          placeholder="Ej. 20"
          keyboardType="numeric"
          value={cantidad}
          onChangeText={setCantidad}
        />

        <Text style={styles.label}>Unidad</Text>

        <TextInput
          style={styles.input}
          placeholder="Ej. kg, cajas, piezas"
          value={unidad}
          onChangeText={setUnidad}
        />
        
        <Text style={styles.label}>Tipo de producto</Text>

        <TextInput
          style={styles.input}
          placeholder="Ej. Abarrotes, Verduras, etc"
          value={unidad}
          onChangeText={setUnidad}
        />

        <Text style={styles.label}>Nombre Operador</Text>

        <TextInput
          style={styles.input}
          placeholder="Su nombre"
          value={procedencia}
          onChangeText={setProcedencia}
        />

        <Text style={styles.label}>Firma recibido </Text>

        <TextInput
          style={styles.input}
          placeholder="Su nombre"
          value={procedencia}
          onChangeText={setProcedencia}
        />

        <TouchableOpacity style={styles.boton} onPress={enviarFormulario}>
          <Text style={styles.textoBoton}>Registrar producto</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f5f5f5",
    padding: 24,
    justifyContent: "center",
  },

  titulo: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },

  subtitulo: {
    fontSize: 16,
    marginBottom: 30,
  },

  formulario: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
  },

  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#ffffff",
  },

  boton: {
    marginTop: 25,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#2e7d32",
    alignItems: "center",
  },

  textoBoton: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});