# Falsona — Proje Bağlamı

Bu dosyaya asla gizli bilgi (API anahtarı, şifre) yazma.

## Proje
"Human or Not" tarzı sosyal Turing testi oyunu: 2 dk anonim sohbet, sonra karşındaki insan mı bot mu tahmini. Canlı: https://falsona.com

## Çalışma kuralları
- Benimle Türkçe konuş; oyunun arayüz metinleri, kod ve yorumlar İngilizce.
- Her değişiklikten sonra hangi dosyaları değiştirdiğini/oluşturduğunu listele.
- Değişiklikler branch + PR ile gider, PR'ı ben merge ederim. Merge sonrası otomatik yayınlanır.
- Benim seçmediğim bir geliştirmeye kendi başına başlama, ancak kesinlikle önerilerden çekinme.

## İki ayrı repo
- Frontend: Efebagci/Efebagci.github.io → GitHub Pages, özel alan adı falsona.com
- Backend: Efebagci/Falsona → Render (free tier)
Her session tek repoyu görür. Şunlardan birini değiştirirsen diğer repoda da yapılması gerekeni bana açıkça söyle:
- WebSocket mesaj protokolü ve HTTP uç noktaları
- Rank formülü (script.js ↔ rank.py, elle senkron tutuluyor)
- TURN_TIMEOUT_SECONDS / ROUND_SECONDS
- Backend adresi (script.js'teki WS_URL / API_URL)

## Ortam ve hosting
- ANTHROPIC_API_KEY ve GATE_PASSWORD Render panelinde tanımlı. Asla koda, commit'e veya dosyaya yazma. .env ve falsona.db repoda yok, olmamalı.
- Render free tier 15 dk trafiksizlikte uyur (ilk bağlantı ~1 dk). Disk kalıcı değil: falsona.db her restart/redeploy'da sıfırlanıyor, hesaplar ve rank'ler kayboluyor.

## Test notu
Starlette TestClient eşzamanlı iki WebSocket'li testlerde rastgele kilitleniyor (kodun değil aracın sorunu). Eşleştirme/sıra/zaman aşımı mantığını gerçek bir uvicorn sunucusu başlatıp "websockets" kütüphanesiyle test et.

## Tasarım
Mevcut görsel dili koru; jenerik "AI sitesi" estetiğine (siyah + neon yeşil, gradient'ler) kayma.
