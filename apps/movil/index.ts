// Punto de entrada: primero las tareas de GPS (deben existir aunque Android despierte la app sin
// pantalla para entregar ubicaciones, p. ej. con la app cerrada a mitad de recorrido) y después
// la app con expo-router.
import "./src/ubicacion/tarea";
import "expo-router/entry";
