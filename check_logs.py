import sqlite3
from datetime import datetime, timedelta

conn = sqlite3.connect('integrador.db')
cursor = conn.cursor()

print("\n" + "="*100)
print("DIAGNÓSTICO ZECURE - EVENTOS PENDENTES")
print("="*100)

# Últimos 5 eventos
cursor.execute("""
    SELECT id, plate, created_at, helios_sent, helios_status_code, helios_response_text 
    FROM events 
    ORDER BY id DESC 
    LIMIT 5
""")

print("\n📋 ÚLTIMOS 5 EVENTOS:")
for row in cursor.fetchall():
    event_id, plate, created_at, sent, status, response = row
    sent_status = "✅ ENVIADO" if sent else "❌ PENDENTE"
    print(f"\nEvent {event_id} | Placa: {plate} | {sent_status}")
    print(f"  Criado: {created_at}")
    print(f"  Status HTTP: {status}")
    if response:
        print(f"  Erro: {response[:150]}")

# Resumo
cursor.execute("SELECT COUNT(*) FROM events WHERE helios_sent = 0")
pending = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM events WHERE helios_sent = 1")
sent = cursor.fetchone()[0]

print(f"\n📊 RESUMO:")
print(f"  Enviados: {sent}")
print(f"  Pendentes: {pending}")

conn.close()
print("\n" + "="*100)