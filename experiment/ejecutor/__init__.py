"""Ejecutor del experimento: corre el conjunto de 40 tareas contra una arquitectura.

Produce trazas y puntuaciones; NO calcula ninguna metrica. El unico lugar donde
se calcula una metrica es el cuaderno de analisis (RM-02, decision 19).

Ciclo de una ejecucion (docs/05, seccion 2):

1. restablece el entorno y compara la huella con la esperada para la tarea;
2. envia los turnos de la persona, uno a uno, sin paralelismo (RM-04, D1);
3. pide al backend la parte de la traza que solo el conoce;
4. arma la `TrazaEjecucion`, la VALIDA contra el esquema y la persiste;
   una traza invalida va a `cuarentena/` y nunca al conjunto oficial;
5. aplica la compuerta automatica y escribe la puntuacion.
"""
