# FitNotes — Roadmap & Task Breakdown
> Aplikacja osobista · PWA + Desktop · 2026  
> Przegląd krytyczny: każdy task oceniony pod kątem czy jest potrzebny, czy polepszy UX, czy nie jest overkill

---

## Legenda

- 🔴 Krytyczne / blokujące
- 🟠 Wysoki priorytet
- 🟡 Średni priorytet
- ~~przekreślone~~ = usunięte z listy z uzasadnieniem
- [ ] Do zrobienia
- [x] Zrobione

---

## FAZA 0 — Naprawa długu technicznego

### 0.1 Refaktoryzacja kodu
- [ ] 🟠 Rozbić `googleFit.js` na osobne funkcje: `fetchSteps()`, `fetchSleep()`, `fetchWeight()`, `fetchHeartRate()`, `fetchCalories()` ⏱ 3h
- [ ] 🟠 Rozbić `DataContext.jsx` na hooki: `useWorkoutSessions`, `useHealthMetrics`, `useCardioSessions` ⏱ 1 dzień
- [ ] 🟠 Usunąć `console.log` z kodu produkcyjnego — dane zdrowotne nie powinny trafiać do konsoli ⏱ 1h
- [ ] 🟠 Dodać `.env.example` ⏱ 10 min

> ~~Vitest + testy jednostkowe~~ — wartościowe, ale dla projektu osobistego blokuje postęp. Wrócić gdy kod się ustabilizuje.  
> ~~Prettier / ESLint~~ — jeśli kod działa i jest czytelny, standaryzacja formatowania to czysta przyjemność, nie potrzeba.  
> ~~Usunąć dotenv z dependencies~~ — 5 minut, zrób od razu bez wpisywania na listę.  
> ~~Usunąć New Bitmap image.bmp~~ — j.w., zrób teraz.

---

## FAZA 1 — Readiness Score

### 1.1 Algorytm i logika
- [x] 🔴 Napisać funkcję `calculateReadinessScore(healthMetrics, sessions)` w `lib/readiness.js` uwzględniającą: sen (35%), HR spoczynkowy vs 30d średnia (25%), dni od ostatniego treningu (20%), kroki (20%) ⏱ 3h

> ~~Konfigurowalność wag przez użytkownika~~ — overkill. Jeden użytkownik. Wagi można zmienić w kodzie jeśli coś nie gra.  
> ~~Trend wagi jako składowa score~~ — zbyt zaszumiony sygnał. Wahania wagi (woda, jedzenie) to za dużo zmiennych.

### 1.2 UI
- [x] 🔴 Komponent `ReadinessWidget` — duża liczba (0–100), 4 stany kolorystyczne, jako pierwsza rzecz na Dashboardzie ⏱ 3h
- [x] 🟠 Tap na widget = rozwinięcie z rozbiciem co wpłynęło na wynik ⏱ 2h
- [x] 🟠 Jedna linia tekstu z sugestią pod score: "Świetny dzień", "Lżejsza sesja", "Odpoczynek" ⏱ 1h

> ~~Animacja count-up od 0 do wartości~~ — wygląda fajnie przez pierwsze 3 razy, potem irytuje. Wystarczy fade-in.  
> ~~Wykres trendu Readiness z 14 dni na Dashboardzie~~ — to jest już na stronie Progress. Duplikowanie danych to szum.  
> ~~Kolor akcentu całego UI zmieniający się z Readiness Score~~ — UI powinno być przewidywalne, nie dynamiczne.

---

## FAZA 2 — Redesign UI/UX

### 2.1 Floating Action Button
- [ ] 🔴 Komponent `FAB` — kontekstowy per ekran, zawsze nad BottomNav:
  - Dashboard → "Rozpocznij trening"
  - Health → "Dodaj metryki"
  - WorkoutLog → "Nowa sesja"
  - Progress / Profile → brak FAB ⏱ 3h
- [ ] 🔴 Podczas treningu FAB zamienia się w pełnoszerokościowy przycisk "Zapisz set" na dole ekranu ⏱ 2h
- [ ] 🟠 FAB chowa się przy scrollowaniu w dół ⏱ 1h

> ~~Animacja scale-up FAB przy załadowaniu~~ — micro-animation bez wartości funkcjonalnej.  
> ~~PWA App Shortcuts~~ — przeniesione do Fazy 5 (Integracje), gdzie pasuje kontekstem.

### 2.2 Swipe Actions
- [ ] 🔴 Hook `useSwipeGesture(onLeft, onRight)` oparty na Touch Events, próg 80px ⏱ 3h
- [ ] 🔴 Ekran treningu: swipe prawo = set ukończony (zielone tło + auto-start timera), swipe lewo = pomiń ⏱ 3h
- [ ] 🟠 Rubber-band effect — karta opiera się przed progiem, skacze po jego przekroczeniu ⏱ 2h
- [ ] 🟡 WorkoutLog: swipe lewo na sesji = usuń z potwierdzeniem ⏱ 2h

> ~~Swipe prawo na sesji = "Powtórz trening"~~ — łatwo o przypadkową aktywację obok usuń. Lepiej przycisk w widoku szczegółów.  
> ~~Swipe góra na kartach Health = rozwiń wykres~~ — nieintuicyjny na liście, użytkownik spodziewałby się scrollowania.  
> ~~Wizualny hint "przeciągnij" przy onboardingu~~ — jeden użytkownik który sam buduje apkę. Zbędne.

### 2.3 Ekran treningu — przeprojektowanie
- [ ] 🔴 Usunąć pośredni ekran `WorkoutSelect` — Dashboard ma przycisk START z nazwą następnego treningu ⏱ 3h
- [ ] 🔴 Jedno ćwiczenie na raz: duża nazwa, przyciski +/– dla ciężaru i powtórzeń, poprzedni wynik jako podpowiedź ⏱ 1 dzień
- [ ] 🟠 Timer startuje automatycznie po zapisaniu seta ⏱ 1h
- [ ] 🟠 Progress bar sesji (ćwiczenie X z Y) ⏱ 1h
- [ ] 🟡 Drag & drop kolejności ćwiczeń ⏱ 4h

> ~~Sugestia ciężaru od AI w tym ekranie~~ — pochodzi z auto-progresji (Faza 7), nie tutaj. Nie mieszać faz.

### 2.4 Micro-interactions
- [ ] 🟠 Haptyka (Vibration API): koniec timera, zapis seta, pobicie PR ⏱ 1h
- [ ] 🟠 Skeleton loaders zamiast pustych ekranów ⏱ 2h
- [ ] 🟠 Design tokens w `design-tokens.css` — kolory, spacing, typografia ⏱ 3h

> ~~Animowane liczniki (count-up)~~ — przy szybkim logowaniu setów animacja będzie przeszkadzać.  
> ~~Page transitions (Framer Motion)~~ — ciężka biblioteka dla jednej animacji. Natywne CSS `view-transitions` wystarczy.  
> ~~Pull-to-refresh~~ — dane synchronizowane automatycznie. Manualny refresh to UX z 2015 roku.  
> ~~Opcja wyboru akcentu kolorystycznego~~ — jeden użytkownik, jeden gust.

---

## FAZA 3 — Offline-first

- [ ] 🔴 Przepisać `sw.js` — strategia Cache First dla assetów statycznych ⏱ 3h
- [ ] 🔴 **Background Sync API** — kolejkowanie zapisów gdy offline, automatyczny sync po powrocie zasięgu ⏱ 1 dzień
- [ ] 🟠 Baner "Tryb offline — synchronizacja w toku" ⏱ 1h

> ~~Periodic Background Sync~~ — odświeżanie danych gdy apka w tle to overkill. Supabase real-time wystarczy gdy apka otwarta.  
> ~~Wskaźnik synchronizacji (ikonka chmury)~~ — baner offline wystarczy. Osobna ikona chmury to UI clutter.

---

## FAZA 4 — Nowe funkcje fitness

### 4.1 Personal Records
- [ ] 🔴 Tabela `personal_records` w Supabase + logika automatycznego wykrywania po sesji ⏱ 4h
- [ ] 🟠 Ekran "Rekordy" — lista PR per ćwiczenie z datą pobicia ⏱ 3h
- [ ] 🟠 Toast + wibracja przy pobiciu PR w trakcie sesji ⏱ 1h

> ~~Oś czasu PR / wykres kiedy bito rekordy~~ — wykres e1RM (niżej) już to pokazuje. Duplikowanie widoku.  
> ~~Porównanie PR między fazami~~ — sensowne dopiero po 2+ pełnych cyklach. Dodać później.

### 4.2 Estimated 1RM
- [ ] 🟠 Funkcja `calculateE1RM(weight, reps)` — formuła Epley ⏱ 1h
- [ ] 🟠 Automatyczne obliczanie e1RM po secie i zapis do bazy ⏱ 2h
- [ ] 🟠 Wykres trendu e1RM per ćwiczenie na stronie Progress ⏱ 3h

> ~~Osobny ekran kalkulatora 1RM~~ — e1RM jest liczone automatycznie. Ręczny kalkulator to relikt.  
> ~~Formuła Brzycki obok Epley~~ — różnica między formułami < 2% dla zakresów 3–10 powt. Jedna formuła wystarczy.

### 4.3 RPE Logging
- [ ] 🟡 Opcjonalne pole RPE (1–10) przy secie — ukryte za "więcej opcji" żeby nie zaśmiecać widoku ⏱ 3h

> ~~RIR obok RPE~~ — to samo wyrażone inaczej. Jedno pole wystarczy.  
> ~~Wizualizacja trendu RPE~~ — RPE jest zbyt subiektywne żeby wykres coś mówił. AI może z tego korzystać, użytkownik nie potrzebuje wykresu.

### 4.4 Periodyzacja
- [ ] 🟡 Wizualna oś czasu tygodni: faza, numer, typ (volume / intensity / deload) ⏱ 4h
- [ ] 🟡 Automatyczna sugestia tygodnia deload na podstawie trendu HR i objętości ⏱ 3h

> ~~Planowanie peak weeks~~ — overkill zanim periodyzacja będzie używana przez 2 pełne cykle.  
> ~~Weekly volume chart~~ — jest już w Progress. Nie duplikować.

### 4.5 Body Measurements
- [ ] 🟡 Tabela `body_measurements` + formularz: klatka, talia, ramię, udo ⏱ 3h
- [ ] 🟡 Wykresy trendów ⏱ 2h

> ~~Ratio talia/biodra z normami zdrowotnymi~~ — aplikacja fitness, nie portal medyczny.  
> ~~Galeria progress photos~~ — Supabase Storage + upload + UI galerii to osobny projekt. Nie warto otwierać.

---

## FAZA 5 — Integracje

- [ ] 🟠 PWA App Shortcuts w `manifest.json`: "Nowy trening", "Zaloguj wagę" ⏱ 1h
- [ ] 🟠 Badging API — badge z liczbą dni bez treningu na ikonie apki ⏱ 1h
- [ ] 🟡 Eksport CSV — dopracować istniejący format ⏱ 2h
- [ ] 🟡 Eksport tygodniowego podsumowania jako Markdown ⏱ 2h

> ~~Apple Health / HealthKit~~ — PWA nie ma dostępu do HealthKit. Research i tak pokaże ścianę.  
> ~~Share Target API~~ — brak realnego use case. Co miałoby być "udostępniane" do apki fitness?  
> ~~Eksport do formatu Strong / FitNotes~~ — po co eksportować z własnej apki do innej własnej apki?

---

## FAZA 6 — Jakość

- [ ] 🟠 **Error Boundaries** w React dla kluczowych komponentów ⏱ 2h
- [ ] 🟠 Lazy loading stron (`React.lazy` + `Suspense`) ⏱ 2h
- [ ] 🟠 Indeksy w Supabase na `user_id + created_at` ⏱ 1h
- [ ] 🟡 **Sentry** — darmowy tier, monitorowanie błędów produkcyjnych ⏱ 2h

> ~~Virtualizacja długich list (react-virtual)~~ — lista 100+ elementów renderuje się płynnie na nowoczesnych urządzeniach. Przedwczesna optymalizacja.  
> ~~Audit WCAG 2.1 AA~~ — aplikacja osobista, jeden użytkownik.  
> ~~Reduced motion~~ — nie task na liście, sposób pisania kodu. Jedna linia CSS per animacja.

---

## FAZA 7 — AI Coach
> Celowo na końcu — potrzebuje 2–3 miesięcy danych historycznych żeby być użyteczny. AI bez danych to wróżenie z fusów.

### 7.1 Fundament
- [ ] 🔴 `lib/aiCoach.js` — wrapper na Anthropic API, system prompt z: ostatnie 30 dni metryk, ostatnie 10 sesji, Readiness Score, cele ⏱ 4h
- [ ] 🔴 Cache Morning Brief — generowany raz rano, nie przy każdym otwarciu apki ⏱ 2h
- [ ] 🟠 Graceful degradation gdy API niedostępne — apka działa normalnie, sekcja AI znika ⏱ 2h

### 7.2 Funkcje
- [ ] 🔴 **Morning Brief** — przy pierwszym otwarciu po 6:00: wyjaśnienie Readiness Score + rekomendacja treningu ⏱ 4h
- [ ] 🟠 **Post-workout Summary** — po zakończeniu sesji: ocena, porównanie z poprzednim ⏱ 3h
- [ ] 🟠 **Plateau Detector** — >3 sesje bez progresu → automatyczna notyfikacja z sugestią ⏱ 4h
- [ ] 🟠 **Auto-progresja ciężarów** — sugestia w ekranie treningu na podstawie historii 3 sesji i completed ratio ⏱ 4h
- [ ] 🟡 **Free chat** — pytania w kontekście pełnej historii ⏱ 3h

### 7.3 UI
- [ ] 🔴 Morning Brief jako karta na Dashboardzie pod Readiness Score — nie osobny ekran ⏱ 3h
- [ ] 🟠 Streaming odpowiedzi — efekt pisania ⏱ 2h

> ~~Osobna strona /coach z interfejsem chat~~ — wartość AI jest wtedy gdy pojawia się w kontekście, nie gdy trzeba do niej nawigować.  
> ~~Weekly Review co poniedziałek~~ — Morning Brief każdego dnia już to pokrywa.  
> ~~Historia konwersacji w Supabase~~ — AI coach to system sugestii, nie asystent do rozmów.  
> ~~Limit dzienny zapytań z licznikiem~~ — cache Morning Brief sprawia że koszt API jest marginalny.

---

## Podsumowanie

| Faza | Opis | Czas |
|------|------|------|
| Faza 0 | Dług techniczny | 2–3 dni |
| Faza 1 | Readiness Score | 1–2 dni |
| Faza 2 | Redesign UI/UX | 1 tydzień |
| Faza 3 | Offline-first | 2–3 dni |
| Faza 4 | Nowe funkcje fitness | 1 tydzień |
| Faza 5 | Integracje | 1–2 dni |
| Faza 6 | Jakość | 1–2 dni |
| Faza 7 | AI Coach | 1 tydzień |
| **RAZEM** | | **~5–6 tygodni** |

---

*Ostatnia aktualizacja: 2026-03-09*
