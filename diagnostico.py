import sqlite3
from pathlib import Path

db_path = Path("integrador.db")

if not db_path.exists():
    print("❌ Banco de dados não encontrado!")
    exit()

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

print("=" * 100)
print("DIAGNÓSTICO ZECURE")
print("=" * 100)

# 1. Eventos recebidos
cursor.execute("SELECT COUNT(*) FROM events")
total_events = cursor.fetchone()[0]
print(f"\n✅ EVENTOS RECEBIDOS: {total_events}")

# 2. Eventos enviados para Helios
cursor.execute("SELECT COUNT(*) FROM events WHERE helios_sent = 1")
sent = cursor.fetchone()[0]
print(f"📤 ENVIADOS HELIOS: {sent}/{total_events}")

# 3. Erros Helios
cursor.execute("SELECT id, plate, helios_status_code, helios_response_text FROM events WHERE helios_sent = 0 LIMIT 3")
errors = cursor.fetchall()
if errors:
    print(f"\n❌ ERROS HELIOS (últimos 3):")
    for row in errors:
        print(f"   Event {row[0]} | Placa: {row[1]} | Status: {row[2]} | Erro: {row[3][:100] if row[3] else 'Sem resposta'}")

# 4. Configuração Helios
cursor.execute("SELECT helios_url, helios_token FROM config LIMIT 1")
config = cursor.fetchone()
if config:
    url, token = config
    print(f"\n⚙️  CONFIGURAÇÃO HELIOS:")
    print(f"   URL: {url if url else '❌ NÃO CONFIGURADA'}")
    print(f"   Token: {'✅ Configurado' if token else '❌ NÃO CONFIGURADO'}")
else:
    print(f"\n❌ NENHUMA CONFIGURAÇÃO HELIOS ENCONTRADA")

# 5. Firebase
cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='firebase_sync'")
has_firebase = cursor.fetchone()[0]
print(f"\n🔥 FIREBASE: {'✅ Habilitado' if has_firebase else '❌ Desabilitado'}")

# 6. Câmeras
cursor.execute("SELECT COUNT(*) FROM cameras WHERE is_active = 1")
active_cams = cursor.fetchone()[0]
print(f"\n📷 CÂMERAS ATIVAS: {active_cams}")

# 7. Placas monitoradas
cursor.execute("SELECT COUNT(*) FROM monitored_plates WHERE is_active = 1")
monitored = cursor.fetchone()[0]
print(f"\n🚗 PLACAS MONITORADAS: {monitored}")

conn.close()
print("\n" + "=" * 100)