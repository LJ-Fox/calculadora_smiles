# Calculadora de Millas Smiles

Herramienta para hacer seguimiento de millas Smiles y comparar el costo real de tickets según el precio al que comprás las millas.

**Funcionalidades:**
- Registro de lotes de millas compradas con su precio y fecha
- Carga de tickets con aerolínea, ruta, fecha, millas requeridas y tasas
- Soporte para modalidades **Normal**, **Millas + Pesos** y **Viaje Fácil**
- Tabla de simulación que calcula el costo total a distintos precios de milla (configurables)
- Seguimiento de tickets Viaje Fácil emitidos: millas canceladas, millas pendientes y alerta de fecha límite (60 días antes del vuelo)
- Dashboard con resumen de millas disponibles y costo de tickets en evaluación

---

## Requisitos

- Python 3.8 o superior
- pip

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone git@github.com:LJ-Fox/calculadora_smiles.git
cd calculadora_smiles

# 2. Instalar dependencias
pip3 install -r requirements.txt
```

---

## Uso local

```bash
python3 app.py
```

Abrí el navegador en **http://localhost:5000**

Los datos se guardan en `datos.json` en la misma carpeta. Hacé backup de ese archivo para no perder tu información.

---

## Deploy en home server (acceso desde la red local)

El servidor ya escucha en todas las interfaces de red, así que solo hace falta correrlo y acceder por IP local.

```bash
python3 app.py
```

Desde cualquier dispositivo en la misma red WiFi, entrá a:

```
http://<IP-del-servidor>:5000
```

Para encontrar la IP del servidor: en Mac ejecutá `ipconfig getifaddr en0`, en Linux `hostname -I`.

### Correrlo en segundo plano (para que no se cierre al cerrar la terminal)

**Con screen:**
```bash
screen -S smiles
python3 app.py
# Para desconectarte sin cerrarlo: Ctrl+A, luego D
# Para volver: screen -r smiles
```

**Con nohup:**
```bash
nohup python3 app.py > smiles.log 2>&1 &
```

### Correrlo como servicio systemd (Linux, para que arranque solo al reiniciar)

Creá el archivo `/etc/systemd/system/smiles.service`:

```ini
[Unit]
Description=Calculadora Smiles
After=network.target

[Service]
WorkingDirectory=/ruta/al/repositorio
ExecStart=/usr/bin/python3 app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Luego:
```bash
sudo systemctl enable smiles
sudo systemctl start smiles
```

---

## Notas

- La app usa Flask en modo desarrollo. Para uso doméstico/personal es suficiente. No la expongas a internet sin ponerle autenticación delante.
- Si cambiás de computadora o querés migrar los datos, copiá el archivo `datos.json`.
