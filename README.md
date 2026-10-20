# Laboratorio: Análisis de Consistencia y Disponibilidad en Kubernetes

**Asignatura:** Aplicaciones Distribuidas  
**Institución:** Universidad de las Fuerzas Armadas ESPE  
**Estudiante:** Jhonny Joel Romero López  
**Repositorio:** [joel1251/P1Lab1RomeroJhonnyKubernetes](https://github.com/joel1251/P1Lab1RomeroJhonnyKubernetes)

---

## 📋 Descripción del Proyecto

Este repositorio contiene el código fuente, los manifiestos de Kubernetes y los scripts de prueba en Grafana k6 desarrollados para el laboratorio de análisis experimental de disponibilidad, resiliencia, escalabilidad y consistencia del estado en Kubernetes.

El proyecto abarca:
1. **Reproducción de laboratorio en clase:** Contenedorización con Docker, despliegue en Kubernetes (Deployment, Service NodePort), distribución de carga entre Pods, prueba de Self-Healing, escalabilidad horizontal, Rolling Update y Rollback ante imagen errónea.
2. **Reto 1 (Consistencia Distribuida):** Coordinador centralizado en memoria con soporte de `Idempotency-Key` y control de `epoch` para garantizar consistencia fuerte e idempotencia en 100 operaciones concurrentes.
3. **Reto 2 (Canary Deployment):** Distribución de tráfico ponderada 80% estable (v2) y 20% candidata (v3) mediante la proporción de réplicas en Deployments paralelos.
4. **Reto 3 (Punto de Degradación):** Evaluación progresiva de carga con k6 (20 a 500 VUs) comparando escenarios con 1, 3 y 10 réplicas, analizando los cuellos de botella en nodo único (Docker Desktop).

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
│   ├── application.yaml          # Despliegue de réplicas de aplicación (v4) conectadas al coordinador
│   ├── coordinator.yaml          # Despliegue y servicio ClusterIP del coordinador central
│   ├── coordinator.js            # Lógica del coordinador en memoria (idempotencia y epoch)
│   ├── consistency-test.js       # Script k6 para prueba de 100 VUs concurrentes
│   ├── Dockerfile                # Dockerfile de la imagen v4 (app + coordinador)
│   └── server.js                 # Servidor v4 que delega el estado en el coordinador
├── distributed-app-lab/
│   ├── deployment.yaml           # Despliegue base inicial
│   ├── deployment-stable.yaml    # Manifiesto para versión estable v2
│   ├── deployment-canary.yaml    # Manifiesto para versión canary v3
│   ├── Dockerfile                # Dockerfile base
│   ├── server.js                 # Código Node.js configurable
│   └── service.yaml              # Servicio Kubernetes NodePort
├── baseline-test.js              # k6: Línea base de rendimiento
├── canary-test.js                # k6: Validación de distribución Canary (80/20)
├── deployment.yaml               # Despliegue base
├── deployment-stable.yaml        # Despliegue v2 estable (4 réplicas)
├── deployment-canary.yaml        # Despliegue v3 canary (1 réplica)
├── Dockerfile                    # Dockerfile raíz para imágenes base
├── load-test.js                  # k6: Medición del punto de degradación progresivo
├── resilience-test.js            # k6: Medición de resiliencia y auto-recuperación (Self-healing)
├── server.js                     # Servidor HTTP Node.js v3
├── service.yaml                  # Servicio NodePort (puerto 30080)
├── smoke-test.js                 # k6: Smoke test de verificación mínima
└── update-test.js                # k6: Medición de tráfico durante Rolling Update
```

---

## 🧪 Pruebas Experimentales con Grafana k6

| Script de Prueba | Propósito | Configuración k6 | Criterios / Thresholds |
| :--- | :--- | :--- | :--- |
| **`smoke-test.js`** | Verificación mínima de funcionamiento | 1 VU, 10 s | `status is 200`, `response contains version` |
| **`baseline-test.js`** | Línea base en condiciones estables | 200 VUs, 30 s | `http_req_failed < 0.01`, `p(95) < 250ms` |
| **`resilience-test.js`** | Resiliencia ante eliminación de un Pod | Rampa 0→20→0 VUs (60 s) | `http_req_failed < 0.01`, `p(95) < 500ms`, `checks > 0.99` |
| **`update-test.js`** | Tráfico durante Rolling Update (v2 → v3) | 10 VUs, 60 s | `http_req_failed < 0.01`, `p(95) < 500ms`, `checks > 0.99` |
| **`canary-test.js`** | Distribución de tráfico (80% v2 / 20% v3) | 10 VUs, 30 s | Métricas custom: `solicitudes_v2`, `solicitudes_v3`, `proporcion_v3` |
| **`load-test.js`** | Punto de degradación (1, 3 y 10 réplicas) | 20, 50, 100, 200 VUs | `p(95) < 250ms`, detección de quiebre de latencia |
| **`consistency-test.js`** | Consistencia distribuida (100 VUs) | 100 VUs, 1 iteración | `count == 100`, verificación atómica y sin duplicados |

---

## 🎯 Retos Independientes

### Reto 1: Consistencia del Estado Distribuido (`consistencia/`)
* **Problema:** En arquitecturas de réplicas en Kubernetes, la memoria no se comparte automáticamente, produciendo contadores locales aislados.
* **Solución Implementada:** Servicio de Coordinador Central en Memoria:
  - Manejo de cabecera `Idempotency-Key` para evitar operaciones duplicadas ante reintentos.
  - Validación de `epoch` única generada al inicio del proceso para detectar reinicios.
  - Reenvío no bloqueante mediante el Service interno `counter-coordinator:3000`.
* **Prueba de Concurrencia:** 100 incrementos concurrentes resultan en exactamente 100 operaciones registradas sin pérdida de actualizaciones.

### Reto 2: Canary Deployment (`canary-test.js`)
* **Estrategia:** Distribución ponderada mediante proporción de réplicas en Kubernetes:
  - 4 Réplicas del grupo Estable (`v2`) → **~80% del tráfico**.
  - 1 Réplica del grupo Canary (`v3`) → **~20% del tráfico**.
* Ambos Deployments se enlazan al mismo `service.yaml` mediante la etiqueta común `app=distributed-app`.
* Los resultados experimentales confirmaron un reparto de **78.8% v2** y **21.2% v3** con cero errores HTTP.

### Reto 3: Punto de Degradación del Sistema (`load-test.js`)
* **Metodología:** Pruebas progresivas de carga variando los Virtual Users (20, 50, 100 y 200 VUs) comparando **1, 3 y 10 réplicas**.
* **Observación Clave:** El primer incumplimiento del umbral `p(95) < 250 ms` ocurrió a partir de **200 VUs** en los tres escenarios.
* **Límite Físico de Infraestructura:** Se concluye que 10 Pods ejecutándose en el mismo nodo local de Docker Desktop comparten los núcleos de CPU, la memoria RAM y la pila de red del host, por lo que escalar Pods en un nodo saturado incrementa la contención de contexto en lugar de aumentar linealmente la capacidad.

---

## 🚀 Despliegue y Ejecución

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
# Smoke test
k6 run smoke-test.js

# Baseline test
k6 run baseline-test.js

# Rolling update test
k6 run update-test.js

# Canary deployment test
k6 run canary-test.js

# Punto de degradación (ejemplo con 50 VUs)
k6 run -e VUS=50 load-test.js
```

### 3. Despliegue del Módulo de Consistencia
```bash
cd consistencia

# Construir imagen v4
docker build -t distributed-app:v4 .

# Desplegar coordinador y aplicación v4
kubectl apply -f coordinator.yaml
kubectl apply -f application.yaml

# Ejecutar prueba de consistencia concurrente
k6 run consistency-test.js
```
