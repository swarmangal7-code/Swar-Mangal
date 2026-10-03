import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'core/theme.dart';
import 'screens/auth/login_screen.dart';
import 'screens/founder/founder_shell.dart';
import 'screens/staff/staff_shell.dart';
import 'services/push_service.dart';
import 'state/auth_provider.dart';
import 'state/sync_manager.dart';
import 'widgets/music_mark.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Draw the app's own background under the status/navigation bars instead
  // of leaving the OS's opaque bar colour as dead space at the edges.
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  final mode = await ThemeController.restore();
  runApp(AcademyApp(initialTheme: mode));
}

class AcademyApp extends StatelessWidget {
  const AcademyApp({super.key, this.initialTheme = ThemeMode.light});
  final ThemeMode initialTheme;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ThemeController(initialTheme)),
        ChangeNotifierProvider(create: (_) => SyncManager()),
      ],
      child: Consumer<ThemeController>(
        builder: (context, theme, _) => AnnotatedRegion<SystemUiOverlayStyle>(
          value: theme.isDark
              ? SystemUiOverlayStyle.light.copyWith(
                  statusBarColor: Colors.transparent,
                  systemNavigationBarColor: Colors.transparent,
                  systemNavigationBarContrastEnforced: false,
                )
              : SystemUiOverlayStyle.dark.copyWith(
                  statusBarColor: Colors.transparent,
                  systemNavigationBarColor: Colors.transparent,
                  systemNavigationBarContrastEnforced: false,
                ),
          child: MaterialApp(
            title: 'Swar Mangal',
            debugShowCheckedModeBanner: false,
            navigatorKey: PushService.navigatorKey,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: theme.mode,
            home: const SyncBinder(child: StartupGate()),
          ),
        ),
      ),
    );
  }
}

/// Owns SyncManager lifecycle: starts once, attaches the API service on
/// login, detaches on logout, and syncs whenever the branch changes.
class SyncBinder extends StatefulWidget {
  const SyncBinder({super.key, required this.child});
  final Widget child;
  @override
  State<SyncBinder> createState() => _SyncBinderState();
}

class _SyncBinderState extends State<SyncBinder> {
  bool _started = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _started) return;
      _started = true;
      final auth = context.read<AuthProvider>();
      final sync = context.read<SyncManager>();
      sync.start(context, onBranchChange: sync.setBranch);
      if (auth.isLoggedIn) {
        sync.attach(auth.service);
        if (auth.branch != null) sync.setBranch(auth.branch!);
      }
    });
  }

  @override
  void dispose() {
    // Stop the SyncManager timer when the binder is torn down so tests (and
    // app teardown) don't leak a pending periodic timer.
    if (_started && context.mounted) context.read<SyncManager>().disposeSelf();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final sync = context.watch<SyncManager>();
    // On subsequent rebuilds (login/logout) re-attach the service. This must
    // happen after the frame: attach/setBranch notify listeners, and doing
    // that during build marks provider scopes dirty mid-build.
    if (_started) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (auth.isLoggedIn) {
          sync.attach(auth.service);
          if (auth.branch != null) sync.setBranch(auth.branch!);
        } else {
          sync.attach(null);
        }
      });
    }
    return SyncScope(manager: sync, child: widget.child);
  }
}

/// Part 7 — startup gate. Runs session restoration once, then routes:
///   restoring → splash/loading
///   no session → LoginScreen
///   founder    → FounderShell
///   staff      → StaffShell
///   temporary network failure (restore error, session still stored) → Retry
class StartupGate extends StatefulWidget {
  const StartupGate({super.key});

  @override
  State<StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<StartupGate> {
  bool _restored = false;
  bool _checkedInitialPush = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_restored) {
      _restored = true;
      // Defer past the build phase: restoreSession() notifies listeners and
      // must never run synchronously inside build (would throw setState-in-build).
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<AuthProvider>().restoreSession();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    // Still restoring → splash/loading, never flash login.
    if (auth.restoring) return const _Splash();
    if (auth.isLoggedIn) {
      // A cold start (app fully killed) that was launched by tapping a system
      // notification only has its RemoteMessage available via
      // getInitialMessage(), and only once. Checking it here — after the
      // user is authenticated and the right shell is about to render, never
      // before — avoids navigating out from under the login/splash flow.
      if (!_checkedInitialPush) {
        _checkedInitialPush = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          PushService.instance.checkInitialMessage(isStaff: auth.isStaff);
        });
      }
      if (auth.isFounder) return const FounderShell();
      return const StaffShell();
    }
    // No stored token → normal login.
    if (auth.error == null) return const LoginScreen();
    // Restore attempted but failed. If a token is still stored (network
    // issue), show Retry. If explicitly invalidated, AuthProvider cleared
    // the token → login. Distinguish by whether a session could still exist.
    return _RestoreError(
      onRetry: () {
        final a = context.read<AuthProvider>();
        a.clearError();
        _restored = false;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) context.read<AuthProvider>().restoreSession();
        });
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: scheme.surface,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHighest,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.music_note, size: 38, color: scheme.primary),
            ),
            const SizedBox(height: 28),
            WaveformMark(active: true, height: 20, color: scheme.primary),
            const SizedBox(height: 12),
            Text('Swar Mangal', style: AppType.eyebrow.copyWith(color: scheme.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

class _RestoreError extends StatelessWidget {
  const _RestoreError({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: scheme.surface,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.cloud_off_outlined, size: 44, color: scheme.error),
                const SizedBox(height: 16),
                Text('Connecting to Swar Mangal failed.',
                    style: AppType.body.copyWith(color: scheme.onSurface)),
                const SizedBox(height: 8),
                Text('Check your network, then retry.',
                    style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () {
                    // Sign out (keeps credentials) → login screen.
                    context.read<AuthProvider>().logout();
                  },
                  child: const Text('Use another account'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}