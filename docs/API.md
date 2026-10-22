# API

Temel adres: `http://127.0.0.1:9149/api`. Etkileşimli belge: `/api/docs`.

| Metot | Yol | Açıklama |
| --- | --- | --- |
| GET | /health | Veritabanı bağlantısı ve sürüm |
| POST | /login | E-posta/parola; kullanıcı, token ve web çerezi |
| POST | /logout | Web çerezini temizle |
| GET | /me | Oturum kullanıcısı |
| GET | /snapshot | Rol ve organizasyona göre çalışma alanı |
| POST | /actions | İdempotent operasyon mutasyonu |

`health` ve `login` dışındaki operasyonlar `Authorization: Bearer <token>` veya `sf_session` çerezi ister. JSON yanıtlarındaki hata mesajı `message` alanındadır. Geçersiz girdi 400, oturum 401, rol/kaynak 403/404, sürüm veya iş kuralı çakışmaları 409 olabilir.

```json
{
  "action": "task.status",
  "input": {"id": "t1", "status": "done", "version": 1},
  "mutationId": "0f8746a1-5a12-4dbd-a883-923db99be610"
}
```

Her yeni kullanıcı işlemi için yeni UUID üret. Ağ nedeniyle aynı işlemi yeniden deniyorsan **aynı** `mutationId` ve aynı input'u kullan. `version`, snapshot'ta okunan sürüm olmalı. Başarılı işlemden sonra güncel snapshot alınır. Mutation anahtarı başka bir input için tekrar kullanılamaz.

| Action | Kullanıcı |
| --- | --- |
| task.create, performance.save, stage.move, shift.create | Organizatör / sahne yöneticisi |
| task.status | Organizatör / sahne yöneticisi veya atanan saha çalışanı |
| reservation.create, reservation.return | Organizatör / sahne yöneticisi / teknik ekip |
| incident.create | Operasyon personeli |
| incident.resolve | Organizatör / sahne yöneticisi |
| ticket.checkin | Organizatör / giriş personeli |
| favorite.toggle | Oturum kullanıcıları, kendi favorileri |

`ticket.checkin` girdisi `{ "qr": "imzalı bilet tokenı" }` olur. Bilet kimliğini doğrudan göndererek imza kontrolü atlanamaz. Ekipman QR etiketi envanter kodudur; bilet tokenı değildir.

Action girdileri ve sınırları için otorite `apps/api/src/domain.ts` içindeki Zod şemalarıdır. Yazma başarılı olduğunda Socket.IO `refresh` olayı, kimliği doğrulanmış organizasyon odasına yayınlanır. Mobilde olay akışı yerine periyodik snapshot yenileme kullanılır.
