# Laboratorio: Análisis de Consistencia y Disponibilidad en Kubernetes

**Asignatura:** Aplicaciones Distribuidas  
**Institución:** Universidad de las Fuerzas Armadas ESPE  
**Estudiante:** Jhonny Joel Romero López  
**Repositorio:** [joel1251/P1Lab1RomeroJhonnyKubernetes](https://github.com/joel1251/P1Lab1RomeroJhonnyKubernetes)

---

## 📋 Descripción del Proyecto

Este laboratorio analiza experimentalmente la disponibilidad, resiliencia, escalabilidad y consistencia del estado en aplicaciones distribuidas desplegadas en Kubernetes, utilizando Node.js como backend y Grafana k6 como herramienta de generación de carga y medición de rendimiento.

El proyecto abarca desde la contenedorización básica y orquestación con réplicas hasta retos avanzados de sincronización de estado distribuido, despliegues progresivos (Canary Deployment) y pruebas de quiebre/degradación del sistema.

---

## 🏗️ Arquitectura del Sistema

```
                      +-----------------------------+
                      |       Cliente / k6          |
                      +--------------+--------------+
                                     |
                       HTTP Requests (NodePort: 30080)
                                     v
                      +-----------------------------+
                      |   Kubernetes Service (Kube) |
                      +--------------+--------------+
                                     |
          +--------------------------+--------------------------+
          | (Round Robin / iptables) |                          |
          v                          v                          v
+-------------------+      +-------------------+      +-------------------+
| Pod App Réplica 1 |      | Pod App Réplica 2 |      | Pod App Réplica 3 |
|    (Node.js)      |      |    (Node.js)      |      |    (Node.js)      |
+---------+---------+      +---------+---------+      +---------+---------+
          |                          |                          |
          +--------------------------+--------------------------+
                                     |
                          Idempotent HTTP Requests
                                     v
                      +-----------------------------+
                      |    Coordinator Pod (State)  |
                      |   - Memoria Centralizada    |
                      |   - Idempotency-Key Cache   |
                      |   - Epoch Validation        |
                      +-----------------------------+
```

---

## 📂 Estructura del Repositorio

```text
├── consistencia/
│   ├── application.yaml          # Despliegue de réplicas de aplicación conectadas al coordinador
│   ├── coordinator.yaml          # Despliegue del servicio centralizado del coordinador
│   ├── coordinator.js            # Lógica del coordinador en memoria (idempotencia y epoch)
│   ├── consistency-test.js       # Script k6 para prueba de 100 VUs concurrentes
│   ├── Dockerfile                # Dockerfile para la imagen de consistencia
│   └── server.js                 # Servidor de aplicación delegando estado al coordinador
├── distributed-app-lab/
│   ├── deployment.yaml           # Despliegue base inicial
│   ├── deployment-stable.yaml    # Manifiesto para versión estable v2 (Canary)
│   ├── deployment-canary.yaml    # Manifiesto para versión canary v3
│   ├── Dockerfile                # Dockerfile de la aplicación base
│   ├── server.js                 # Código Node.js de la práctica de clase
│   └── service.yaml              # Servicio Kubernetes tipo NodePort
├── baseline-test.js              # Prueba k6: Línea base de rendimiento
├── canary-test.js                # Prueba k6: Verificación de tráfico Canary (80/20)
├── deployment.yaml               # Manifiesto de despliegue general
├── deployment-stable.yaml        # Despliegue v2 estable
├── deployment-canary.yaml        # Despliegue v3 canary
├── Dockerfile                    # Dockerfile raíz
├── Lab1_Consistencia_Disponibilidad_Romero_Jhonny.pdf # Informe final en formato ESPE
├── Lab1RomeroJhonny.docx         # Documento fuente del informe técnico
├── load-test.js                  # Prueba k6: Carga general
├── resilience-test.js            # Prueba k6: Resiliencia ante eliminación de Pods (Self-healing)
├── server.js                     # Servidor HTTP Node.js v3
├── service.yaml                  # Servicio Kubernetes NodePort
├── smoke-test.js                 # Prueba k6: Smoke test de verificación mínima
├── update-test.js                # Prueba k6: Medición durante Rolling Update
├── test-canary.ps1               # Script PowerShell para validar distribución Canary
└── test-payment.ps1              # Script de prueba adicional
```

---

## 🧪 Pruebas Experimentales con Grafana k6

### 1. Smoke Test (`smoke-test.js`)
- **Objetivo:** Verificar la conectividad mínima y disponibilidad básica del servicio.
- **Configuración:** 1 VU, duración corta, validación de status 200 y headers.

### 2. Baseline Test (`baseline-test.js`)
- **Objetivo:** Establecer una métrica de referencia en condiciones normales de operación sin estrés.
- **Métricas evaluadas:** Solicitudes/seg, latencias `avg`, `p(90)`, `p(95)`, `max`.

### 3. Resilience Test (`resilience-test.js`)
- **Objetivo:** Validar la capacidad de **Self-healing** de Kubernetes.
- **Procedimiento:** Mientras k6 envía tráfico continuo, se elimina deliberadamente un Pod réplica (`kubectl delete pod ...`).
- **Observación:** El ReplicaSet detecta la desviación del estado deseado y crea inmediatamente un nuevo Pod sin interrumpir la disponibilidad global del servicio.

### 4. Rolling Update Test (`update-test.js`)
- **Objetivo:** Monitorear el comportamiento del sistema durante una actualización de versión sin tiempo de inactividad (*Zero-Downtime Deployment*).
- **Observación:** Coexistencia progresiva de Pods con versión anterior y nueva hasta completar la transición sin errores `5xx`.

---

## 🎯 Retos Independientes

### Reto 1: Consistencia del Estado Distribuido (`consistencia/`)
* **Problema:** Múltiples réplicas de Node.js mantienen memoria independiente, por lo que solicitudes atendidas por distintos Pods incrementan contadores locales aislados.
* **Solución Implementada:** Servicio de Coordinador Central en Memoria con:
  - Manejo de cabecera `Idempotency-Key` por operación.
  - Validación de `epoch` única para detectar reinicios no controlados.
  - Procesamiento atómico en el event loop sin operaciones de I/O bloqueantes.
* **Prueba de Concurrencia (`consistency-test.js`):**
  - 100 operaciones concurrentes simultáneas (`100 VUs`).
  - Resultado final exacto: **100**, eliminando condiciones de carrera y duplicados.

### Reto 2: Canary Deployment (`canary-test.js`)
* **Estrategia:** Distribución ponderada mediante proporción de réplicas en Kubernetes:
  - 4 Réplicas de versión Estable (`v2`) → **~80% del tráfico**.
  - 1 Réplica de versión Canary (`v3`) → **~20% del tráfico**.
* Ambos Deployments comparten el mismo selector de etiquetas en el `service.yaml`.
* k6 registra en cada iteración el VU, el Pod y la Versión que atendió la petición, confirmando la coexistencia y ratio de distribución.

### Reto 3: Punto de Degradación del Sistema (`load-test.js`)
* **Metodología:** Pruebas progresivas de carga variando los Virtual Users (20, 50, 100, 200, 500 VUs) comparando escenarios con **1, 3 y 10 réplicas**.
* **Criterios de Quiebre:**
  - Aumento drástico de latencia `p(95)`.
  - Aparición de errores HTTP (`http_req_failed > 0`).
  - Saturación del *throughput* (Requests/sec deja de escalar).
* **Análisis de Infraestructura:** Se documenta por qué 10 Pods sobre el mismo nodo de Docker Desktop comparten CPU y memoria del host, demostrando que el escalamiento horizontal local tiene límites físicos impuestos por el hardware del nodo.

---

## 🚀 Despliegue y Ejecución

### Requisitos Previos
- Docker Desktop con Kubernetes habilitado
- Node.js v18+
- Grafana k6
- kubectl

### 1. Despliegue de la Aplicación Base
```bash
# Construir imagen Docker
docker build -t distributed-app:v1 .

# Aplicar manifiestos de Kubernetes
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Verificar estado de los recursos
kubectl get pods -o wide
kubectl get svc
```

### 2. Ejecutar Pruebas con k6
```bash
# Ejecutar smoke test
k6 run smoke-test.js

# Ejecutar baseline test
k6 run baseline-test.js

# Ejecutar prueba de actualización (Rolling Update)
k6 run update-test.js
```

### 3. Despliegue del Módulo de Consistencia
```bash
cd consistencia

# Aplicar coordinador y réplicas de aplicación
kubectl apply -f coordinator.yaml
kubectl apply -f application.yaml

# Ejecutar prueba de consistencia distribuida
k6 run consistency-test.js
```

---

## 📄 Informe Técnico

El informe formal completo con capturas de pantalla, tablas comparativas, análisis de métricas y conclusiones técnicas se encuentra disponible en:
- Formato PDF: [`Lab1_Consistencia_Disponibilidad_Romero_Jhonny.pdf`](./Lab1_Consistencia_Disponibilidad_Romero_Jhonny.pdf)
- Documento editable: [`Lab1RomeroJhonny.docx`](./Lab1RomeroJhonny.docx)
