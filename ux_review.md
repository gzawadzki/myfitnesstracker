# FitNotes — Surowa Ocena UX
> Oparta na rzeczywistym kodzie źródłowym. Bez owijania w bawełnę.

---

## Ogólna ocena: 4.5/10

Aplikacja wygląda **całkiem nieźle** i ma solidny design system — ciemny motyw, spójne kolory, porządne karty. Ale warstwa interakcji i przepływ danych użytkownika są pełne decyzji które wyglądają jak kompromisy deweloperskie zaprezentowane jako UX. To częsty błąd gdy jeden developer pisze i UI i logikę — kod działa, więc UX "wystarczy".

---

## Ekran po ekranie

---

### Login — 6/10

```jsx
<Auth supabaseClient={supabase} providers={[]} />
```

**Problemy:**
- `providers={[]}` — brak logowania przez Google/Apple. Użytkownik który już połączył Google Fit i tak musi zakładać osobne konto email. To tarcie na starcie.
- `<title>client</title>` w `index.html` — karta przeglądarki pokazuje "client". Nie "FitNotes". Nie żart.
- Formularz Supabase Auth jest po angielsku, bez możliwości zmiany języka.
- Brak ekranu powitalnego / onboardingu — po pierwszym logowaniu użytkownik ląduje na pustym dashboardzie z napisem "No workouts available. Please import your training plan." — bez instrukcji co zrobić dalej.

---

### Dashboard (Home) — 4/10

**Problem #1: `prompt()` jako główna metoda edycji danych**

```javascript
onClick={() => {
  const val = prompt("Enter sleep in hours (e.g. 7.5):", sleep || 0);
  if(val && !isNaN(val)) saveDailyHealthMetric(todayStr, 'sleep_hours', parseFloat(val));
}}
```

`prompt()` to natywne okno dialogowe przeglądarki z roku 1996. Na telefonie wygląda katastrofalnie — inne czcionki, inne kolory, brak walidacji, brak jednostek, brak klawiatury numerycznej (zależy od urządzenia). Użytkownik w siłowni, w rękawiczkach, z potem na palcach, dostaje okienko systemowe. To jest najgorszy UX w całej aplikacji.

Jednocześnie istnieje piękna strona `Health.jsx` z dedykowanymi polami input, walidacją i osobnymi przyciskami Save dla każdego metryki. Ta strona istnieje i nie jest linkowana z dashboardu — jest schowana za ikoną HeartPulse w dolnej nawigacji. Dashboard zamiast kierować do niej, reimplementuje ten sam flow przez `prompt()`.

**Problem #2: Ikona użytkownika prowadzi do... zewnętrznego URL**

```jsx
<img src="https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff" />
```

Avatar użytkownika pobiera obrazek z zewnętrznego serwisu (`ui-avatars.com`) z hardcoded `name=User`. Każdy użytkownik ma dokładnie taki sam avatar z literą "U". Ikona jest klikalna i prowadzi do `/profile` — ale nie ma żadnego wskaźnika że jest klikalna (brak hover state w CSS dla tej konkretnej ikony).

**Problem #3: "Welcome back, Athlete!"**

Powitanie jest hardcoded. Nie używa emaila, nie używa nic z sesji. Każdy użytkownik to "Athlete". Profil pobiera inicjały z emaila — te inicjały mogłyby być tutaj użyte, ale nie są.

**Problem #4: Deprecation warning zawsze widoczny**

```jsx
<div className="flex items-center gap-2 mb-4 p-2 rounded text-xs text-warning" ...>
  <AlertTriangle size={14} />
  <span>Google Fit sync will stop working in 2026. Manual entry is recommended.</span>
</div>
```

Ten żółty pasek ostrzegawczy jest pokazywany **przy każdym wejściu na dashboard**, niezależnie od tego czy user w ogóle używa Google Fit. Użytkownik który nigdy nie połączył Google Fit widzi ostrzeżenie o jego deprecacji. To jak ostrzeżenie o przeterminowaniu leku który nigdy nie był brany.

**Problem #5: Metryki bez kontekstu**

Dashboard pokazuje Sleep, Steps i Weight. Ale:
- Sleep `0h 0m` z czerwonym "Low" na nowym dniu wygląda jak błąd, nie jak "jeszcze nie wpisałeś"
- Steps `0` z "Recovery" — Recovery to dobry stan czy zły? W tym kontekście brzmi jak "odpoczywasz" nie jak "nie wpisałeś"
- Brak stanu "puste / nie zalogowano dziś"

**Problem #6: "Next Workout" to zawsze pierwsze ćwiczenie z listy**

```javascript
const nextWorkout = db.workouts && db.workouts.length > 0 ? db.workouts[0] : null;
```

Aplikacja nie śledzi który trening był ostatni. "Next Workout" to po prostu `db.workouts[0]` — zawsze pierwszy w liście. Jeśli user właśnie skończył trening A i wróci na dashboard, znowu zobaczy trening A jako "Next". Nie ma żadnej logiki rotacji.

---

### Workout Log (/workouts) — 5/10

**Problem #1: Brak filtrowania i wyszukiwania**

Lista sesji posortowana malejąco, brak filtra po ćwiczeniu, brak wyszukiwania, brak filtra po dacie. Przy 20 sesjach (limit z DataContext) to do zniesienia. Ale limit 20 to też problem UX — starsze treningi znikają.

**Problem #2: Expand/collapse przez cały wiersz, ale przycisk Trash2 jest w środku**

```jsx
<div onClick={() => toggleExpand(session.id)}>  // ← cały wiersz klikalny
  ...
  <button onClick={async (e) => {
    e.stopPropagation();  // ← trzeba stopPropagation żeby trash nie expandował
    ...
  }}>
    <Trash2 size={16} />
  </button>
```

To działa technicznie, ale jest wzorcem który psuje się na dotykowych urządzeniach gdy obszary dotyku nakładają się. Mały przycisk Trash2 (16px ikona) w środku 100% szerokości klikalnego wiersza jest trudny do trafienia bez przypadkowego expandowania.

**Problem #3: Potwierdzenie przez `window.confirm()`**

```javascript
if(window.confirm("Are you sure you want to delete this workout?")) {
```

Znowu natywny dialog. Na iOS `confirm()` wygląda jak systemowy alert. Brak możliwości customizacji, brak UX spójności z resztą aplikacji.

**Problem #4: Brak stanu po usunięciu**

Po usunięciu sesji lista się aktualizuje (dobrze) ale brak toast/powiadomienia "Workout deleted". User nie ma potwierdzenia że akcja się udała — lista po prostu staje się krótsza.

---

### New Workout (/workouts/new) — 6/10

To **najlepiej przemyślany ekran** z perspektywy UX. Skip, Swap, Reorder, Rest Timer — to są realne potrzeby w siłowni i są zaimplementowane. Ale:

**Problem #1: Waga w kg zawsze — brak jednostki**

Kolumna "KG" w tabeli serii jest hardcoded. User który ćwiczy w lbs nie ma wyjścia. Preferencje wagi (kg/lbs) istnieją w bazie przez `user_preferences` ale `NewWorkout.jsx` ich nie czyta.

**Problem #2: Rest Timer bez dźwięku / wibracji**

Rest timer odlicza od 90 sekund. W siłowni użytkownik nie patrzy cały czas na ekran. Gdy timer dochodzi do 0 — po prostu znika. Brak powiadomienia dźwiękowego, brak wibracji (Web Vibration API jest dostępne), brak żadnego sygnału że czas minął.

**Problem #3: Przycisk "Finish" w nagłówku i na dole jednocześnie**

```jsx
// Nagłówek
<button onClick={finishWorkout}><Save size={16} /> Finish</button>

// Dół strony
<button onClick={isLastExercise ? finishWorkout : nextExercise}>
  {isLastExercise ? 'Review & Finish' : 'Next Exercise'}
</button>
```

Są dwa przyciski kończące trening — jeden zawsze widoczny w headerze (`Finish`) i jeden na dole który zmienia etykietę (`Next Exercise` → `Review & Finish`). Oba robią dokładnie to samo (`finishWorkout()`). Nie ma żadnego "review" przed zapisem — etykieta "Review & Finish" obiecuje coś czego nie ma.

**Problem #4: Brak komunikatu o niezapisanych zmianach**

Jeśli user klika `←` żeby wyjść w połowie treningu — nic się nie dzieje, po prostu wychodzi. Nie ma żadnego "Are you sure? Your progress will be lost."

**Problem #5: Progress Pills są nieczytalne dla długich nazw ćwiczeń**

```javascript
const words = (ex.name || '').split(' ');
const shortName = words.length > 2 ? `${words[0]} ${words[1]}` : ex.name;
```

"Romanian Deadlift" → "Romanian Deadlift" (OK). "Barbell Back Squat" → "Barbell Back". Ale "Cable Lateral Raise" → "Cable Lateral" — co nie jest oczywistym skrótem. Brak tooltipa z pełną nazwą.

---

### Progress (/progress) — 5/10

**Problem #1: Wykres ograniczony do 20 sesji bez informacji o tym**

User z 6 miesiącami historii widzi wykres ostatnich ~5 tygodni. Nie ma żadnej informacji że dane są ucięte. Brak "Load more" lub wyboru zakresu dat.

**Problem #2: Domyślnie `ex_1` — może być puste**

Jeśli baza nie ma ćwiczenia o ID `ex_1`, wykres pokazuje "No history data available" bez wyjaśnienia. User myśli że nie ma historii w ogóle.

**Problem #3: Recovery Correlation — złe empty state**

```jsx
<p className="text-xs text-muted mt-2 italic">
  Keep logging both workouts and sleep! Need more data across well-rested and tired days...
</p>
```

Ten tekst jest zbyt długi i zbyt akademicki jak na aplikację fitness. W siłowni nikt nie czyta "statistically significant correlations". Powinno być: "Log 5+ workouts and sleep to see your recovery score."

**Problem #4: Selector ćwiczenia to `<select>` bez stylowania**

```jsx
<select className="text-sm font-medium flex-1" value={selectedExUrlId} ...>
```

Dropdown ćwiczeń to natywny `<select>`. Na iOS wygląda jak element z 2008 roku, jest niemożliwy do customizacji i nie pasuje do reszty design systemu.

**Problem #5: Brak daty ostatniego treningu na karcie**

Karty metryk pokazują "Workouts: 12", "Volume: 4.2T", "Avg Sleep: 7h 30m". Brak informacji "Last workout: 3 days ago" — która jest prawdopodobnie najbardziej przydatną informacją dla kogoś wracającego do aplikacji.

---

### Health (/health) — 6.5/10

Najlepsza strona. Ale:

**Problem #1: Trzy osobne przyciski Save — brak "Save All"**

Użytkownik który chce zalogować sen, kroki i wagę musi kliknąć Save trzy razy. Jeśli robi to rano przed siłownią — to trzy oddzielne operacje sieciowe, trzy spinnery. Naturalny flow to: wpisz wszystko → zapisz.

**Problem #2: Inputs gubią wpisaną wartość po Save**

Po kliknięciu Save dla snu, inputy **nie resetują się** — wartość zostaje w polu. User nie wie czy kliknął już Save czy nie. Brak wizualnego potwierdzenia że konkretny metrics został zapisany (brak "✓ Saved" przy każdym inputcie).

**Problem #3: Cele (My Targets) schowane za ikoną Settings**

Ustawienie celów jest schowane za ikoną ⚙️ w rogu karty Insights. Użytkownik który po raz pierwszy widzi ten ekran nie wie że może ustawić cele. Brak onboardingu, brak pustego stanu który zachęca do ustawienia celów.

**Problem #4: Goal weight domyślnie `80` niezależnie od usera**

```javascript
weight_goal: goals.weight || 80,
```

Jeśli user nie ustawił celu wagowego, formularz pokazuje `80` jako wartość domyślną. Użytkownik 65kg kobieta wchodzi do ustawień celów i widzi `80` — musi to usunąć zanim wpisze swoją wartość. To jest micro-friction który sygnalizuje "ta aplikacja nie jest dla mnie".

**Problem #5: Historia pokazuje tylko 5 wpisów, wykres 30 dni — niespójność**

Historia pod kartą wagi pokazuje ostatnie 5 wpisów, ale wykres pokazuje 30 dni. Nie ma żadnego "Zobacz więcej" pod historią. 5 wpisów to za mało żeby ocenić trend.

**Problem #6: Brak jednostki przy inputcie wagi**

```jsx
<input type="number" ... placeholder={`e.g. ${goals.weight || 80}`} />
```

Input nie pokazuje jednostki (kg/lbs) przy polu. Tylko label nad nim mówi "(kg)". Na małym ekranie telefonu, label może być poza polem widzenia gdy klawiatura jest otwarta.

---

### Profile — 6/10

**Problem #1: "Inject Test Analytics" w produkcyjnym UI**

```jsx
<div>
  <p className="text-xs text-muted mb-3">Inject 14 days of mock workouts...</p>
  <button onClick={injectMockData}>Inject Test Analytics</button>
</div>
```

Przycisk deweloperski do wstrzykiwania testowych danych jest widoczny dla **każdego użytkownika produkcyjnego**. Jeśli user w to kliknie przez ciekawość i potwierdzi — traci prawdziwe dane lub miesza je z losowymi wartościami. Jedynym zabezpieczeniem jest `window.confirm()`.

**Problem #2: "Edit goals in Health tab →" zamiast bezpośredniej edycji**

Profil pokazuje cele (sen, kroki, wagę) ale przekierowuje do Health tab żeby je edytować. To niepotrzebne przeskakiwanie. Albo edytuj tutaj albo nie pokazuj tutaj.

**Problem #3: Status "Active" hardcoded**

```jsx
<span className="badge badge-success text-[10px]">Active</span>
```

Każdy użytkownik ma status "Active". Zawsze. Co to oznacza? Konto aktywne? Plan aktywny? Subskrypcja aktywna? Jeśli nic nie oznacza — nie powinno być.

---

## Problemy przekrojowe — na każdym ekranie

---

### CROSS-01: Zero stanów pustych z wartością

Puste stany to: "No workouts logged yet.", "No sleep data recorded yet.", "No history data available." — suchy tekst, brak ikony, brak call-to-action, brak wskazówki co zrobić.

Dobre puste stany mówią: **co jest puste + dlaczego warto wypełnić + jak to zrobić**.

---

### CROSS-02: Obsługa błędów tylko na Health i NewWorkout, nigdzie indziej

`Health.jsx` ma `setError` i pokazuje komunikat. `DataContext` ma `setError` i pokazuje ekran błędu. Ale `Progress.jsx`, `WorkoutLog`, `WorkoutSelect` — brak jakiejkolwiek obsługi błędów UI. Jeśli Supabase zwróci błąd podczas renderowania wykresu w Progress — nic się nie stanie, ekran będzie pusty.

---

### CROSS-03: `window.confirm()` i `window.prompt()` używane 5 razy

| Gdzie | Co |
|---|---|
| Dashboard | `prompt()` dla sleep |
| Dashboard | `prompt()` dla steps |
| Dashboard | `prompt()` dla weight |
| WorkoutLog | `confirm()` przed usunięciem |
| Profile | `confirm()` przed inject mock data |

To jest 5 miejsc gdzie aplikacja wychodzi poza własny design system. Na iOS szczególnie `prompt()` jest archaiczny i łamie immersję.

---

### CROSS-04: Brak toast systemu — ani sukces ani błąd nie są spójnie komunikowane

- Health.jsx: error banner w DOM
- WorkoutLog: `alert()` przy błędzie
- NewWorkout: `alert()` przy błędzie
- Dashboard: `setSyncStatus('success')` z auto-hide
- Profile inject: `alert()` po zakończeniu

5 różnych sposobów komunikowania wyniku akcji. Brak centralnego systemu powiadomień (toast). Użytkownik nie wie czego się spodziewać.

---

### CROSS-05: Brak jakiegokolwiek loading state dla nawigacji między ekranami

Przejście między zakładkami jest natychmiastowe z animacją `fadeIn`. Ale jeśli dane jeszcze się ładują (np. preferencje), ekran Health pokazuje skeleton — to dobrze. Problem w tym że Dashboard nie ma żadnego shimmer/skeleton dla swoich kart — dane "wyskoczeją" gdy się załadują.

---

### CROSS-06: Klawiatura numeryczna nie jest wymuszana konsekwentnie

```jsx
// NewWorkout — typ number, OK
<input type="number" ... />

// Health — typ number, OK
<input type="number" ... />

// Dashboard — prompt(), klawiatura zależy od urządzenia
prompt("Enter sleep in hours (e.g. 7.5):", sleep || 0)
```

---

### CROSS-07: `card:hover` na karcie podnosi element o 2px — złe na mobile

```css
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
```

Hover transform na karcie jest zaprojektowany dla myszy. Na urządzeniu dotykowym `hover` jest emulowany przez przeglądarkę i często "przykleja się" po tapnięciu — karta zostaje uniesiona do czasu następnego tknięcia. Na karcie w workout loggu, gdzie cały wiersz jest klikalny, to powoduje wizualny artefakt.

---

## Zestawienie ocen ekranów

| Ekran | Ocena | Główny problem |
|---|---|---|
| Login | 6/10 | Brak SSO, tytuł "client" |
| Dashboard | 4/10 | `prompt()`, hardcoded dane, zły empty state |
| Workout Log | 5/10 | `confirm()`, mały target Trash, limit 20 bez info |
| New Workout | 6/10 | Rest timer bez sygnału, dwa przyciski Finish |
| Progress | 5/10 | Hardcoded ex_1, natywny select, ucięta historia |
| Health | 6.5/10 | Trzy osobne Save, schowane cele |
| Profile | 6/10 | Dev button w produkcji, hardcoded "Active" |
| **Średnia** | **5.5/10** | |

---

## Top 5 rzeczy do naprawy — największy impact na UX

### 1. Zamień `prompt()` na inline input na Dashboardzie
Trzy `prompt()` na głównym ekranie to najgorsza pojedyncza decyzja UX. Dodaj małe inline input lub sheet modal — masz już gotowe komponenty w Health.jsx.

### 2. Dodaj globalny toast system
Jeden komponent, 50 linii kodu, naprawia niespójność komunikacji na wszystkich ekranach.

### 3. Rest Timer → wibracja i powiadomienie dźwiękowe
```javascript
// Web Vibration API — jeden liner
if (restTimer === 1) navigator.vibrate?.([200, 100, 200]);
```
Kluczowa funkcja dla użytkownika w siłowni który nie patrzy na ekran.

### 4. Usuń "Inject Test Analytics" z produkcyjnego UI
Schować za flagą `import.meta.env.DEV` — jeden warunek, zero ryzyka dla użytkownika.

### 5. Napraw "Next Workout" — śledź ostatnią sesję
Jeden lookup po `db.sessions` + `template_id` żeby wiedzieć które ćwiczenie było ostatnio i pokazać następne w rotacji.

---

*UX review oparty na kodzie źródłowym i mapowaniu interakcji. Marzec 2026.*
