import { Pool } from "pg";
import { randomBytes, scryptSync } from "node:crypto";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export async function seed(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(914901)");
    if ((await client.query("SELECT id FROM organizations LIMIT 1")).rowCount) {
      await client.query("COMMIT");
      return;
    }
    await client.query(
      "INSERT INTO organizations VALUES ('org-north','Northline Productions'),('org-other','Independent Productions')",
    );
    const people = [
      ["u-admin", "Berkay Özdemir", "admin", "Operasyon"],
      ["u-stage", "Deniz Arslan", "stage", "Sahne"],
      ["u-tech", "Ece Demir", "technician", "Teknik"],
      ["u-gate", "Mert Yılmaz", "gate", "Giriş"],
      ["u-guest", "Selin Kaya", "attendee", "Katılımcı"],
      ["u-other", "Other Operator", "admin", "Operasyon"],
    ];
    for (const [id, name, role, team] of people)
      await client.query("INSERT INTO users VALUES($1,$2,$3,$4,$5,$6,$7)", [
        id,
        id === "u-other" ? "org-other" : "org-north",
        name,
        `${id.slice(2)}@stageflow.local`,
        hashPassword("Stageflow2026!"),
        role,
        team,
      ]);
    await client.query(
      "INSERT INTO festivals VALUES ('northline-26','org-north','Northline Festival','KüçükÇiftlik Park, İstanbul','2026-10-24','2026-10-25',8000),('private-fest','org-other','Private Event','Ankara','2026-10-24','2026-10-25',100)",
    );
    const stages = [
      ["main", "Ana Sahne", "#b64a39", 46, 44, 4500],
      ["grove", "Grove Stage", "#738573", 73, 28, 2000],
      ["studio", "Studio", "#b39b73", 27, 67, 1000],
    ];
    for (const [id, name, color, x, y, capacity] of stages)
      await client.query("INSERT INTO stages VALUES($1,$2,$3,$4,$5,$6,$7)", [
        id,
        "northline-26",
        name,
        color,
        x,
        y,
        capacity,
      ]);
    const shows = [
      [
        "p1",
        "main",
        "Nova Collective",
        "INDIE / ALTERNATIVE",
        "16:00",
        "17:00",
      ],
      [
        "p2",
        "main",
        "The Midnight Letters",
        "ALTERNATIVE ROCK",
        "18:00",
        "19:15",
      ],
      ["p3", "main", "Atlas & The City", "ELECTRONIC LIVE", "20:30", "22:00"],
      ["p4", "grove", "Duru Akın", "SOUL / R&B", "15:30", "16:30"],
      ["p5", "grove", "Coastal Sounds", "DREAM POP", "17:30", "18:30"],
      ["p6", "grove", "Slow Motion Club", "ELECTRONIC", "19:30", "21:00"],
      ["p7", "studio", "Analog Sessions", "DJ SET", "16:30", "18:00"],
      ["p8", "studio", "After Hours Radio", "HOUSE", "19:00", "20:30"],
      [
        "p9",
        "main",
        "Northern Echoes",
        "INDIE ROCK",
        "2026-10-25T17:00",
        "2026-10-25T18:30",
      ],
    ];
    for (const [id, stage, artist, genre, start, end] of shows)
      await client.query(
        "INSERT INTO performances(id,festival_id,stage_id,artist,genre,starts_at,ends_at)VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          "northline-26",
          stage,
          artist,
          genre,
          start.includes("T")
            ? start + "+03:00"
            : `2026-10-24T${start}:00+03:00`,
          end.includes("T") ? end + "+03:00" : `2026-10-24T${end}:00+03:00`,
        ],
      );
    const tasks = [
      [
        "t1",
        "Ana PA sistemini kontrol et",
        "Sol ve sağ hatları test et. FOH onayı gerekli.",
        "Teknik",
        "main",
        "u-tech",
        "high",
        "doing",
        "11:00",
        [],
      ],
      [
        "t2",
        "Ana sahne ses kontrolü",
        "PA kontrolü tamamlandıktan sonra sanatçı monitörlerini test et.",
        "Teknik",
        "main",
        "u-tech",
        "high",
        "todo",
        "12:00",
        ["t1"],
      ],
      [
        "t3",
        "Sanatçı karşılama alanını hazırla",
        "Backstage yönlendirmesi ve su istasyonlarını kontrol et.",
        "Sahne",
        "main",
        "u-stage",
        "medium",
        "todo",
        "13:00",
        [],
      ],
      [
        "t4",
        "Grove ışık rig kontrolü",
        "DMX adreslerini ve güvenlik halatlarını doğrula.",
        "Teknik",
        "grove",
        "u-tech",
        "high",
        "todo",
        "11:30",
        [],
      ],
      [
        "t5",
        "Giriş turnikelerini test et",
        "Örnek biletle tüm girişleri doğrula.",
        "Giriş",
        "main",
        "u-gate",
        "medium",
        "done",
        "10:00",
        [],
      ],
      [
        "t6",
        "Studio kablo düzeni",
        "Kablo köprüleri ve saha geçişleri.",
        "Sahne",
        "studio",
        "u-stage",
        "low",
        "todo",
        "14:00",
        [],
      ],
      [
        "t7",
        "Ekip brifingini tamamla",
        "Ekip liderleriyle programı ve iletişim kanallarını paylaş.",
        "Operasyon",
        null,
        "u-admin",
        "medium",
        "done",
        "09:30",
        [],
      ],
    ];
    for (const [
      id,
      title,
      description,
      team,
      stage,
      assignee,
      priority,
      status,
      time,
      deps,
    ] of tasks)
      await client.query(
        "INSERT INTO tasks(id,festival_id,title,description,team,stage_id,assignee,priority,status,due_at,dependencies)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          id,
          "northline-26",
          title,
          description,
          team,
          stage,
          assignee,
          priority,
          status,
          `2026-10-24T${time}:00+03:00`,
          deps,
        ],
      );
    for (const [id, name, category, quantity, code] of [
      ["eq1", "Shure SM58", "Mikrofon", 12, "SF-MIC-001"],
      ["eq2", "Sennheiser IEM G4", "Monitör", 8, "SF-IEM-001"],
      ["eq3", "Aputure 600d", "Aydınlatma", 6, "SF-LIGHT-001"],
      ["eq4", "Motorola DP1400", "İletişim", 24, "SF-RADIO-001"],
    ])
      await client.query("INSERT INTO equipment VALUES($1,$2,$3,$4,$5,$6)", [
        id,
        "northline-26",
        name,
        category,
        quantity,
        code,
      ]);
    await client.query(
      "INSERT INTO reservations VALUES('r1','eq1','main',4,'2026-10-24T14:00:00+03:00','2026-10-24T23:00:00+03:00',false,'u-admin')",
    );
    for (const [id, user, stage] of [
      ["sh1", "u-tech", "main"],
      ["sh2", "u-stage", "grove"],
      ["sh3", "u-gate", "main"],
    ])
      await client.query("INSERT INTO shifts VALUES($1,$2,$3,$4,$5,$6)", [
        id,
        "northline-26",
        user,
        stage,
        "2026-10-24T09:00:00+03:00",
        "2026-10-24T17:00:00+03:00",
      ]);
    await client.query(
      "INSERT INTO tickets VALUES('ticket-guest','northline-26','u-guest','NORTH-2026-0001','Hafta sonu',null,null)",
    );
    await client.query(
      "INSERT INTO incidents(id,festival_id,title,description,severity,stage_id,created_by)VALUES('i1','northline-26','Grove yükleme alanı kapalı','Teslimat aracı için servis yolu kontrol edilecek.','medium','grove','u-stage')",
    );
    await client.query(
      "INSERT INTO audit(org_id,user_id,name,action,entity,details)VALUES('org-north','u-admin','Berkay Özdemir','Festival çalışma alanı oluşturuldu','northline-26','{}')",
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
