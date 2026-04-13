# TaskFlow – Jamo Operations System

System zarządzania zadaniami i reklamacjami dla Jamo + Healthy Future + PackPack.

## Co zawiera
- Logowanie (Supabase Auth)
- 3 obszary robocze (Jamo+Healthy, PackPack, Private)
- Zadania z pełnymi polami biznesowymi (nr zamówienia, SKU, klient, marketplace, reklamacja)
- Statusy: Otwarte / W trakcie / Oczekuje / Pilne / Zamknięte
- Real-time sync (zmiany widoczne natychmiast na wszystkich urządzeniach)
- PWA – działa jak aplikacja na Android i iPhone
- RLS – każdy widzi tylko swoje obszary

## KROK 1 – Supabase: Uruchom schemat bazy danych

1. Wejdź na supabase.com → Twój projekt → **SQL Editor**
2. Wklej całą zawartość pliku `supabase-schema.sql`
3. Kliknij **Run**

## KROK 2 – GitHub: Wgraj kod

1. Wejdź na github.com → **New repository**
2. Nazwa: `jamo-task-system`, Public lub Private
3. Kliknij **Create repository**
4. Wgraj wszystkie pliki z tego folderu

## KROK 3 – Vercel: Wdróż aplikację

1. Wejdź na vercel.com → **Add New Project**
2. Wybierz repozytorium `jamo-task-system` z GitHub
3. Dodaj zmienne środowiskowe (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://rewjvzuuhbqeacexpmwv.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (twój klucz z Supabase)
4. Kliknij **Deploy**

## KROK 4 – Dodaj pierwszego użytkownika (admina)

1. Wejdź na Supabase → **Authentication → Users → Invite user**
2. Wpisz swój email
3. Odbierz email, ustaw hasło
4. W **SQL Editor** ustaw rolę admina:

```sql
update profiles set role = 'admin', full_name = 'Jarosław', areas = '{"jamo_healthy","packpack","private"}' where id = 'TWOJE_USER_ID';
```

## Gotowe!
Aplikacja działa na PC, Android i iPhone przez przeglądarkę.
Na Android/iPhone: Chrome → menu → "Dodaj do ekranu głównego" = działa jak natywna apka.
