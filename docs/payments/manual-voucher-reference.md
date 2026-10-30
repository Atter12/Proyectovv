# Referencias de comprobantes aprobados

Revisión del 30 de octubre de 2026. La calibración utiliza comprobantes asociados
a intenciones `manual`, `source=dashboard`, `status=succeeded`: 76 registros,
75 aprobaciones desde dashboard y una corrección de operaciones. 76 tienen fecha
de aprobación; 75 tienen identificador de aprobador. Solo dos incluyen notas;
no se puede reconstruir una justificación individual que no quedó registrada.
72 registran un ajuste del monto. No mezclar canceladas, fallidas ni pruebas
con esta muestra positiva. El estado histórico no se cambia durante la prueba.

## Variantes observadas directamente

| Presentación aprobada | Lectura correcta |
| --- | --- |
| iPhone, cabecera azul y check naranja sólido | La fila Enviado a contiene receptor y cuenta; Desde contiene el origen. |
| Android, check de contorno, publicidad y controles de descarga | Mismos significados; no exigir cabecera azul ni una proporción determinada. |
| Foto inclinada de otro teléfono | Seguir cada fila y sus valores a la derecha, incluso si ocupan varias líneas. El alias Cuenta Cursos/Productos pertenece a Desde. |
| Comprobante BCP descargado | Puede no tener barras del teléfono ni botones; no es sospechoso por ello. |
| Captura del correo BCP | Monto transferido y Datos de la operación; Enviado a es el destino. Las barras Responder/Reenviar son normales. No se consulta un buzón para validarla. |
| Interbank personal | Cuenta cargo, Cuenta destino y Código de operación; el CCI puede estar separado por espacios. |
| Constancia empresarial Interbank | Transferencia exitosa, Cuenta de cargo, Cuenta de destino y Número de solicitud. Este último identifica una transferencia final; no convertir una solicitud pendiente en pago. Puede omitir el titular. |
| Detalle de movimiento resumido | Puede mostrar monto y operación sin cuenta o titular. Reconocer el soporte no proporciona los datos ausentes. |

Tamaño, resolución, sistema operativo, zoom, inclinación, publicidad, tipografía
y controles no son por sí solos pruebas de manipulación. La extracción conserva
el bloque de destino separado del bloque de origen y el nombre original de la
referencia de operación. No agregar cuentas al registro a partir de una captura.

## Controles y límites de la evaluación

- La aprobación histórica es una referencia positiva para reconocer el documento,
  no una lista de hashes a autorizar ni una instrucción de volver a acreditar.
- Separar reconocimiento del soporte, exactitud de extracción y elegibilidad
  según cuenta/titular/monto/moneda/duplicados. Binance y pagos con tarjeta no son
  transferencias a la cuenta bancaria configurada aunque hayan sido aprobados.
- La prueba de duplicados debe usar los estados reclamantes de producción;
  una intención fallida o cancelada no equivale a una segunda acreditación.
- La prueba local usa las cuentas del código, no confirma overrides de producción.
- `MANUAL_VOUCHER_VISION_MODEL` permite configurar el lector de recargas manuales.
  Su valor predeterminado es `gpt-4.1`, tras observar inversión de filas con el
  lector anterior incluso en una captura nítida. La configuración general de
  visión y el flujo sin cuentas destino no cambian.
- Se ajustan instrucciones y reglas de lectura; no se entrenan los pesos del modelo.
  Las imágenes privadas y los datos de clientes no se incluyen en el repositorio.
- Una captura visualmente coherente no confirma por sí sola la liquidación bancaria
  ni permite garantizar la detección de todas las falsificaciones.

Prueba sin efectos contables: ejecutar únicamente el analizador con las imágenes
aprobadas y comparar sus resultados con las etiquetas revisadas. Nunca invocar
el procesador de uploads ni la confirmación de depósitos para reproducir el histórico.
