# Flutter Public Digest Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate no-login Flutter app that reads public RSS daily digests from Supabase.

**Architecture:** Keep this repository as the Supabase contract owner by adding a public read-only view over `daily_digests`. Create a sibling Flutter app that uses only Supabase URL + anon key, reads `public_daily_digests`, and renders list/detail screens with local widget state.

**Tech Stack:** Supabase Postgres migrations, Flutter, Dart, `supabase_flutter`, `flutter_markdown`, `flutter_test`.

---

## File Structure

### This repository: `C:/work/RSS-News`

- Create: `supabase/migrations/202606030001_public_daily_digests_view.sql`
  - Defines public read contract for anonymous Flutter reads.
- No frontend React files change.

### Flutter sibling project: `C:/work/RSS-News-Mobile`

- Create by command: `flutter create rss_news_mobile .`
- Modify: `pubspec.yaml`
  - Add `supabase_flutter`, `flutter_markdown`.
- Create: `lib/config.dart`
  - Reads public Supabase config from Dart defines.
- Create: `lib/digest.dart`
  - Immutable digest model + row parser.
- Create: `lib/digests_repository.dart`
  - Supabase query wrapper for `public_daily_digests`.
- Replace: `lib/main.dart`
  - Supabase initialization and app root.
- Create: `lib/digest_list_screen.dart`
  - Loads and renders digest list.
- Create: `lib/digest_detail_screen.dart`
  - Renders selected digest markdown.
- Create: `test/digest_test.dart`
  - Unit tests row parsing.
- Create: `test/digests_repository_test.dart`
  - Tests query mapping with fake repository client boundary where practical.
- Create: `test/digest_screens_test.dart`
  - Widget tests list/detail states.

---

### Task 1: Public Digest View Migration

**Files:**
- Create: `supabase/migrations/202606030001_public_daily_digests_view.sql`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/202606030001_public_daily_digests_view.sql`:

```sql
create or replace view public.public_daily_digests as
select
  id,
  digest_date,
  title,
  summary,
  item_count,
  generated_at
from public.daily_digests;

revoke all on public.public_daily_digests from public;
grant usage on schema public to anon, authenticated;
grant select on public.public_daily_digests to anon, authenticated;
```

Rationale: normal Postgres views run with owner permissions. The base table keeps owner-only RLS, while this view intentionally exposes only public columns.

- [ ] **Step 2: Verify migration applies locally**

Run from `C:/work/RSS-News`:

```bash
supabase db reset
```

Expected: migrations apply without SQL errors.

- [ ] **Step 3: Verify anonymous select contract**

Run from `C:/work/RSS-News` after local Supabase is running:

```bash
supabase db psql --command "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'public_daily_digests' order by ordinal_position;"
```

Expected output includes exactly these column names:

```text
id
digest_date
title
summary
item_count
generated_at
```

- [ ] **Step 4: Verify private fields are absent**

Run:

```bash
supabase db psql --command "select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'public_daily_digests' and column_name in ('owner_id', 'storage_bucket', 'storage_path', 'run_id');"
```

Expected output count: `0`.

- [ ] **Step 5: Commit migration**

```bash
git add supabase/migrations/202606030001_public_daily_digests_view.sql
git commit -m "feat: expose public digest read view"
```

---

### Task 2: Create Flutter Project And Dependencies

**Files:**
- Create project folder: `C:/work/RSS-News-Mobile`
- Modify: `C:/work/RSS-News-Mobile/pubspec.yaml`

- [ ] **Step 1: Scaffold Flutter project**

Run from `C:/work`:

```bash
mkdir RSS-News-Mobile
cd RSS-News-Mobile
flutter create --project-name rss_news_mobile .
```

Expected: Flutter creates `lib/main.dart`, `pubspec.yaml`, `test/widget_test.dart`.

- [ ] **Step 2: Add dependencies**

Run from `C:/work/RSS-News-Mobile`:

```bash
flutter pub add supabase_flutter flutter_markdown
```

Expected: `pubspec.yaml` and `pubspec.lock` update.

- [ ] **Step 3: Replace generated smoke test**

Replace `test/widget_test.dart` with:

```dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('test harness is active', () {
    expect(1 + 1, 2);
  });
}
```

- [ ] **Step 4: Verify scaffold**

Run:

```bash
flutter test
```

Expected: test passes.

- [ ] **Step 5: Commit scaffold**

```bash
git init
git add .
git commit -m "chore: scaffold flutter digest app"
```

---

### Task 3: Add Config, Digest Model, Repository

**Files:**
- Create: `C:/work/RSS-News-Mobile/lib/config.dart`
- Create: `C:/work/RSS-News-Mobile/lib/digest.dart`
- Create: `C:/work/RSS-News-Mobile/lib/digests_repository.dart`
- Create: `C:/work/RSS-News-Mobile/test/digest_test.dart`

- [ ] **Step 1: Write failing model tests**

Create `test/digest_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:rss_news_mobile/digest.dart';

void main() {
  test('parses digest row from Supabase view', () {
    final digest = Digest.fromRow({
      'id': '11111111-1111-1111-1111-111111111111',
      'digest_date': '2026-06-03',
      'title': 'Daily Brief',
      'summary': '# Headline\n\nBody',
      'item_count': 7,
      'generated_at': '2026-06-03T08:30:00Z',
    });

    expect(digest.id, '11111111-1111-1111-1111-111111111111');
    expect(digest.digestDate, DateTime.utc(2026, 6, 3));
    expect(digest.title, 'Daily Brief');
    expect(digest.summary, '# Headline\n\nBody');
    expect(digest.itemCount, 7);
    expect(digest.generatedAt, DateTime.parse('2026-06-03T08:30:00Z'));
  });

  test('normalizes null summary to empty string', () {
    final digest = Digest.fromRow({
      'id': '22222222-2222-2222-2222-222222222222',
      'digest_date': '2026-06-04',
      'title': 'No Summary',
      'summary': null,
      'item_count': 0,
      'generated_at': '2026-06-04T08:30:00Z',
    });

    expect(digest.summary, '');
  });
}
```

- [ ] **Step 2: Run failing model tests**

Run:

```bash
flutter test test/digest_test.dart
```

Expected: FAIL because `lib/digest.dart` does not exist.

- [ ] **Step 3: Add config**

Create `lib/config.dart`:

```dart
class AppConfig {
  const AppConfig({required this.supabaseUrl, required this.supabaseAnonKey});

  final String supabaseUrl;
  final String supabaseAnonKey;

  static AppConfig fromEnvironment() {
    const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
    const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

    if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
      throw StateError(
        'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Pass both with --dart-define.',
      );
    }

    return const AppConfig(
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey,
    );
  }
}
```

- [ ] **Step 4: Add digest model**

Create `lib/digest.dart`:

```dart
class Digest {
  const Digest({
    required this.id,
    required this.digestDate,
    required this.title,
    required this.summary,
    required this.itemCount,
    required this.generatedAt,
  });

  final String id;
  final DateTime digestDate;
  final String title;
  final String summary;
  final int itemCount;
  final DateTime generatedAt;

  factory Digest.fromRow(Map<String, dynamic> row) {
    return Digest(
      id: row['id'] as String,
      digestDate: DateTime.parse(row['digest_date'] as String),
      title: row['title'] as String,
      summary: (row['summary'] as String?) ?? '',
      itemCount: row['item_count'] as int,
      generatedAt: DateTime.parse(row['generated_at'] as String),
    );
  }
}
```

- [ ] **Step 5: Add repository**

Create `lib/digests_repository.dart`:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

import 'digest.dart';

class DigestsRepository {
  const DigestsRepository(this._client);

  final SupabaseClient _client;

  Future<List<Digest>> listDigests({int limit = 30}) async {
    final rows = await _client
        .from('public_daily_digests')
        .select('id,digest_date,title,summary,item_count,generated_at')
        .order('digest_date', ascending: false)
        .limit(limit);

    return rows.map(Digest.fromRow).toList(growable: false);
  }
}
```

- [ ] **Step 6: Run model tests**

Run:

```bash
flutter test test/digest_test.dart
```

Expected: PASS.

- [ ] **Step 7: Analyze**

Run:

```bash
flutter analyze
```

Expected: no issues.

- [ ] **Step 8: Commit model/repository**

```bash
git add lib/config.dart lib/digest.dart lib/digests_repository.dart test/digest_test.dart
git commit -m "feat: add digest data access"
```

---

### Task 4: Build List And Detail Screens

**Files:**
- Replace: `C:/work/RSS-News-Mobile/lib/main.dart`
- Create: `C:/work/RSS-News-Mobile/lib/digest_list_screen.dart`
- Create: `C:/work/RSS-News-Mobile/lib/digest_detail_screen.dart`
- Create: `C:/work/RSS-News-Mobile/test/digest_screens_test.dart`

- [ ] **Step 1: Write widget tests**

Create `test/digest_screens_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rss_news_mobile/digest.dart';
import 'package:rss_news_mobile/digest_detail_screen.dart';
import 'package:rss_news_mobile/digest_list_screen.dart';

void main() {
  final digest = Digest(
    id: '11111111-1111-1111-1111-111111111111',
    digestDate: DateTime.utc(2026, 6, 3),
    title: 'Daily Brief',
    summary: '# Top Story\n\nDigest body',
    itemCount: 7,
    generatedAt: DateTime.parse('2026-06-03T08:30:00Z'),
  );

  testWidgets('list screen renders digest rows', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DigestListScreen(loadDigests: () async => [digest]),
      ),
    );

    expect(find.text('Loading digests...'), findsOneWidget);
    await tester.pumpAndSettle();

    expect(find.text('Daily Brief'), findsOneWidget);
    expect(find.text('2026-06-03 • 7 items'), findsOneWidget);
  });

  testWidgets('list screen renders empty state', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DigestListScreen(loadDigests: () async => []),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('No digests yet'), findsOneWidget);
    expect(find.text('Published daily digests will appear here.'), findsOneWidget);
  });

  testWidgets('list screen renders error state and retry button', (tester) async {
    var calls = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: DigestListScreen(
          loadDigests: () async {
            calls += 1;
            throw Exception('network failed');
          },
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Failed to load digests'), findsOneWidget);
    expect(find.textContaining('network failed'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();

    expect(calls, 2);
  });

  testWidgets('detail screen renders markdown summary', (tester) async {
    await tester.pumpWidget(MaterialApp(home: DigestDetailScreen(digest: digest)));

    expect(find.text('Daily Brief'), findsOneWidget);
    expect(find.text('2026-06-03 • 7 items'), findsOneWidget);
    expect(find.text('Top Story'), findsOneWidget);
    expect(find.text('Digest body'), findsOneWidget);
  });

  testWidgets('detail screen renders empty summary state', (tester) async {
    final emptyDigest = Digest(
      id: digest.id,
      digestDate: digest.digestDate,
      title: digest.title,
      summary: '',
      itemCount: digest.itemCount,
      generatedAt: digest.generatedAt,
    );

    await tester.pumpWidget(MaterialApp(home: DigestDetailScreen(digest: emptyDigest)));

    expect(find.text('No summary available'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run failing widget tests**

Run:

```bash
flutter test test/digest_screens_test.dart
```

Expected: FAIL because screen files do not exist.

- [ ] **Step 3: Add detail screen**

Create `lib/digest_detail_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import 'digest.dart';

class DigestDetailScreen extends StatelessWidget {
  const DigestDetailScreen({super.key, required this.digest});

  final Digest digest;

  @override
  Widget build(BuildContext context) {
    final date = _formatDate(digest.digestDate);

    return Scaffold(
      appBar: AppBar(title: const Text('Digest')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(digest.title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text('$date • ${digest.itemCount} items'),
          const SizedBox(height: 24),
          if (digest.summary.trim().isEmpty)
            const Text('No summary available')
          else
            MarkdownBody(data: digest.summary),
        ],
      ),
    );
  }
}

String _formatDate(DateTime date) {
  final year = date.year.toString().padLeft(4, '0');
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
}
```

- [ ] **Step 4: Add list screen**

Create `lib/digest_list_screen.dart`:

```dart
import 'package:flutter/material.dart';

import 'digest.dart';
import 'digest_detail_screen.dart';

class DigestListScreen extends StatefulWidget {
  const DigestListScreen({super.key, required this.loadDigests});

  final Future<List<Digest>> Function() loadDigests;

  @override
  State<DigestListScreen> createState() => _DigestListScreenState();
}

class _DigestListScreenState extends State<DigestListScreen> {
  late Future<List<Digest>> _digests;

  @override
  void initState() {
    super.initState();
    _digests = widget.loadDigests();
  }

  void _retry() {
    setState(() {
      _digests = widget.loadDigests();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('RSS News Digests')),
      body: FutureBuilder<List<Digest>>(
        future: _digests,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: Text('Loading digests...'));
          }

          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Failed to load digests'),
                    const SizedBox(height: 8),
                    Text(snapshot.error.toString(), textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: _retry, child: const Text('Retry')),
                  ],
                ),
              ),
            );
          }

          final digests = snapshot.data ?? const <Digest>[];
          if (digests.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('No digests yet'),
                    SizedBox(height: 8),
                    Text('Published daily digests will appear here.'),
                  ],
                ),
              ),
            );
          }

          return ListView.separated(
            itemCount: digests.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final digest = digests[index];
              final date = _formatDate(digest.digestDate);

              return ListTile(
                title: Text(digest.title),
                subtitle: Text('$date • ${digest.itemCount} items'),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => DigestDetailScreen(digest: digest),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

String _formatDate(DateTime date) {
  final year = date.year.toString().padLeft(4, '0');
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
}
```

- [ ] **Step 5: Replace app root**

Replace `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config.dart';
import 'digest_list_screen.dart';
import 'digests_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final config = AppConfig.fromEnvironment();
  await Supabase.initialize(
    url: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
  );

  runApp(const RssNewsMobileApp());
}

class RssNewsMobileApp extends StatelessWidget {
  const RssNewsMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    final repository = DigestsRepository(Supabase.instance.client);

    return MaterialApp(
      title: 'RSS News Digests',
      theme: ThemeData(colorSchemeSeed: Colors.blue, useMaterial3: true),
      home: DigestListScreen(loadDigests: repository.listDigests),
    );
  }
}
```

- [ ] **Step 6: Run widget tests**

Run:

```bash
flutter test test/digest_screens_test.dart
```

Expected: PASS.

- [ ] **Step 7: Run full Flutter tests**

Run:

```bash
flutter test
```

Expected: PASS.

- [ ] **Step 8: Run analyzer**

Run:

```bash
flutter analyze
```

Expected: no issues.

- [ ] **Step 9: Commit UI**

```bash
git add lib/main.dart lib/digest_list_screen.dart lib/digest_detail_screen.dart test/digest_screens_test.dart test/widget_test.dart
git commit -m "feat: add digest list and detail screens"
```

---

### Task 5: Manual End-To-End Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run app against Supabase**

Run from `C:/work/RSS-News-Mobile` with real project values:

```bash
flutter run --dart-define=SUPABASE_URL=https://YOUR-PROJECT.supabase.co --dart-define=SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Expected: app opens without login and shows digest list.

- [ ] **Step 2: Verify list behavior**

Manual checks:

- Latest digests appear first.
- Each row shows title.
- Each row shows date as `YYYY-MM-DD`.
- Each row shows item count.

- [ ] **Step 3: Verify detail behavior**

Manual checks:

- Tap a digest row.
- Detail screen opens.
- Title/date/item count match tapped row.
- Markdown summary renders headings/body text.
- Back navigation returns to list.

- [ ] **Step 4: Verify anonymous-only boundary**

Confirm app config uses anon key only:

```bash
flutter run --dart-define=SUPABASE_URL=https://YOUR-PROJECT.supabase.co --dart-define=SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Expected: no login prompt and no service-role key in command, source, assets, or logs.

- [ ] **Step 5: Final verification commands**

Run in `C:/work/RSS-News`:

```bash
supabase db reset
```

Expected: migrations apply.

Run in `C:/work/RSS-News-Mobile`:

```bash
flutter test
flutter analyze
```

Expected: tests pass and analyzer reports no issues.

---

## Self-Review Notes

- Spec coverage: migration exposes public view; Flutter app reads public summaries; no login, writes, feed management, or service-role key.
- Data boundary: public view excludes `owner_id`, `storage_bucket`, `storage_path`, and `run_id`.
- Type consistency: `Digest` fields match view columns and repository select list.
- No placeholder tasks remain; commands and expected outcomes are explicit.
