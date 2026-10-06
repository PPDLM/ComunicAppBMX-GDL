import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

type Categoria = "Abarrotes" | "Medicina" | "Frutas/Verduras";

type Producto = {
  nombre: string;
  categoria: Categoria;
  cantidad: string;
  unidad: string;
};

export default function FormularioRecepcion() {
  const [idRecepcion, setIdRecepcion] = useState("");
  const [lugarRecoleccion, setLugarRecoleccion] = useState("");
  const [nombreOperador, setNombreOperador] = useState("");
  const [imagen, setImagen] = useState<string | null>(null);

  const [productos, setProductos] = useState<Producto[]>([
    {
      nombre: "",
      categoria: "Abarrotes",
      cantidad: "",
      unidad: "",
    },
  ]);

  const agregarProducto = () => {
    setProductos([
      ...productos,
      {
        nombre: "",
        categoria: "Abarrotes",
        cantidad: "",
        unidad: "",
      },
    ]);
  };

  const actualizarProducto = (
    index: number,
    campo: keyof Producto,
    valor: string
  ) => {
    const nuevaLista = [...productos];

    nuevaLista[index] = {
      ...nuevaLista[index],
      [campo]: valor,
    };

    setProductos(nuevaLista);
  };

  const eliminarProducto = (index: number) => {
    setProductos(productos.filter((_, i) => i !== index));
  };

  const tomarFoto = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();

    if (!permiso.granted) {
      Alert.alert(
        "Permiso requerido",
        "Necesitas permitir el acceso a la cámara."
      );
      return;
    }

    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });

    if (!resultado.canceled) {
      setImagen(resultado.assets[0].uri);
    }
  };

  const enviarFormulario = () => {
    const recepcion = {
      idRecepcion,
      lugarRecoleccion,
      productos,
      nombreOperador,
      imagen,
    };

    console.log(recepcion);

    Alert.alert("Éxito", "Recepción registrada");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Recepción de productos</Text>

      {/* DATOS GENERALES */}

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Datos de recepción</Text>

        <Text style={styles.label}>ID</Text>

        <TextInput
          style={styles.input}
          placeholder="Ej. REC-001"
          value={idRecepcion}
          onChangeText={setIdRecepcion}
        />

        <Text style={styles.label}>Lugar de recolección</Text>

        <TextInput
          style={styles.input}
          placeholder="Ej. Tienda, empresa o dirección"
          value={lugarRecoleccion}
          onChangeText={setLugarRecoleccion}
        />
      </View>

      {/* PRODUCTOS */}

      <Text style={styles.seccionTituloExterior}>Productos</Text>

      {productos.map((producto, index) => (
        <View key={index} style={styles.productoCard}>
          <Text style={styles.productoTitulo}>
            Producto {index + 1}
          </Text>

          <Text style={styles.label}>Nombre</Text>

          <TextInput
            style={styles.input}
            placeholder="Ej. Arroz"
            value={producto.nombre}
            onChangeText={(texto) =>
              actualizarProducto(index, "nombre", texto)
            }
          />

          <Text style={styles.label}>Categoría</Text>

          <View style={styles.categorias}>
            {[
              "Abarrotes",
              "Medicina",
              "Frutas/Verduras",
            ].map((categoria) => (
              <TouchableOpacity
                key={categoria}
                style={[
                  styles.categoriaBoton,
                  producto.categoria === categoria &&
                    styles.categoriaSeleccionada,
                ]}
                onPress={() =>
                  actualizarProducto(
                    index,
                    "categoria",
                    categoria
                  )
                }
              >
                <Text
                  style={[
                    styles.categoriaTexto,
                    producto.categoria === categoria &&
                      styles.categoriaTextoSeleccionado,
                  ]}
                >
                  {categoria}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Cantidad</Text>

          <TextInput
            style={styles.input}
            placeholder="Ej. 20"
            keyboardType="numeric"
            value={producto.cantidad}
            onChangeText={(texto) =>
              actualizarProducto(index, "cantidad", texto)
            }
          />

          <Text style={styles.label}>Unidad</Text>

          <TextInput
            style={styles.input}
            placeholder="Ej. kg, cajas, piezas"
            value={producto.unidad}
            onChangeText={(texto) =>
              actualizarProducto(index, "unidad", texto)
            }
          />

          {productos.length > 1 && (
            <TouchableOpacity
              style={styles.botonEliminar}
              onPress={() => eliminarProducto(index)}
            >
              <Text style={styles.textoEliminar}>
                Eliminar producto
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={styles.botonAgregar}
        onPress={agregarProducto}
      >
        <Text style={styles.textoBoton}>
          + Agregar producto
        </Text>
      </TouchableOpacity>

      {/* OPERADOR */}

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Operador</Text>

        <Text style={styles.label}>Nombre del operador</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          value={nombreOperador}
          onChangeText={setNombreOperador}
        />

        <TouchableOpacity
          style={styles.botonFoto}
          onPress={tomarFoto}
        >
          <Text style={styles.textoBoton}>
            Tomar imagen
          </Text>
        </TouchableOpacity>

        {imagen && (
          <Image
            source={{ uri: imagen }}
            style={styles.imagen}
          />
        )}
      </View>

      <TouchableOpacity
        style={styles.botonEnviar}
        onPress={enviarFormulario}
      >
        <Text style={styles.textoBoton}>
          Registrar recepción
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f5f5f5",
  },

  titulo: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },

  seccion: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },

  seccionTitulo: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },

  seccionTituloExterior: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
  },

  productoCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
  },

  productoTitulo: {
    fontSize: 18,
    fontWeight: "bold",
  },

  label: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "white",
  },

  categorias: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  categoriaBoton: {
    borderWidth: 1,
    borderColor: "#999",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  categoriaSeleccionada: {
    backgroundColor: "#2e7d32",
    borderColor: "#2e7d32",
  },

  categoriaTexto: {
    color: "#333",
  },

  categoriaTextoSeleccionado: {
    color: "white",
    fontWeight: "bold",
  },

  botonAgregar: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#1976d2",
    alignItems: "center",
    marginBottom: 20,
  },

  botonFoto: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#555",
    alignItems: "center",
  },

  botonEnviar: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#2e7d32",
    alignItems: "center",
    marginBottom: 30,
  },

  botonEliminar: {
    marginTop: 15,
    alignItems: "center",
  },

  textoEliminar: {
    color: "#c62828",
    fontWeight: "bold",
  },

  textoBoton: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },

  imagen: {
    width: "100%",
    height: 220,
    marginTop: 15,
    borderRadius: 10,
  },
});