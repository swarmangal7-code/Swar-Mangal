import 'dart:convert';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:provider/provider.dart';

import '../screens/shared/approvals_screen.dart';
import '../screens/shared/expenses_screen.dart';
import '../screens/shared/inquiries_screen.dart';
import '../screens/shared/inquiry_profile_screen.dart';
import '../screens/shared/my_requests_screen.dart';
import '../screens/shared/payout_preview_screen.dart';
import '../screens/shared/receipts_screen.dart';
import '../screens/shared/school_invoice_screen.dart';
import '../screens/shared/students_screen.dart';
import '../screens/shared/teacher_profile_screen.dart';
import '../screens/shared/timetable_screen.dart';
import '../screens/shared/todays_classes_screen.dart';
import '../state/auth_provider.dart';
import '../widgets/update_dialog.dart';
import 'api_service.dart';
import 'update_service.dart';

/// Must be a top-level (or static) function, marked with this pragma, so
/// Android can call it in a fresh background isolate when a message arrives
/// while the app is fully killed. A plain "notification" payload (which is
/// all this app ever sends — see fcm.ts) is already shown by the OS without
/// any code running here; this exists so Firebase never warns about a
/// missing handler. The `data` map that rides alongside it (`type`/`ref`/
/// `screen`) is read on tap, not here — see checkInitialMessage() and
/// _handleTap() below, driven from main.dart's StartupGate once the app has
/// relaunched and the user is back on an authenticated shell.
///
/// That fresh isolate never ran main() or any login flow, so Firebase must
/// be (re-)initialised here even though PushService.start already did it in
/// the foreground isolate — this call is cheap and idempotent.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

const _channelId = 'swarmangal_updates';
const _channelName = 'Swar Mangal updates';

/// Registers this device for push notifications and keeps the server's copy
/// of the token current. A no-op everywhere Firebase isn't configured yet
/// (no google-services.json) or in demo mode (there is no server to tell).
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  /// The app's single Navigator, set on MaterialApp in main.dart. PushService
  /// is a singleton with no BuildContext of its own (it is driven by Firebase
  /// callbacks that fire with no widget in scope), so a tap on a notification
  /// reaches the navigator through this global key instead.
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  bool _ready = false;
  bool _initialMessageChecked = false;
  ApiService? _api;
  String? _registeredToken;
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

  /// Call once after a real (non-demo) login. Safe to call again on every
  /// app resume — it only does the one-time setup once.
  Future<void> start(ApiService api) async {
    _api = api;
    if (_ready) {
      await _registerCurrentToken();
      return;
    }
    try {
      await Firebase.initializeApp();
    } catch (e) {
      // No Firebase project configured on this build yet. This is the
      // expected state until google-services.json is added — push simply
      // stays off; nothing else in the app depends on it.
      debugPrint('[push] Firebase not configured, push disabled: $e');
      return;
    }
    try {
      final settings = await FirebaseMessaging.instance
          .requestPermission(alert: true, badge: true, sound: true);
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[push] notification permission denied by the user');
        return;
      }
      await _initLocalNotifications();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      FirebaseMessaging.onMessage.listen(_showWhileForeground);
      // The app was already running (foreground or background, not killed)
      // and the user tapped the system notification — deep-link immediately.
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _handleTap(m.data));
      FirebaseMessaging.instance.onTokenRefresh.listen(_register);
      _ready = true;
      await _registerCurrentToken();
    } catch (e) {
      debugPrint('[push] setup failed: $e');
    }
  }

  /// Cold-start case: the app was fully killed and the user tapped the system
  /// notification to launch it. `getInitialMessage()` only ever returns that
  /// one message once, so this must run exactly once per launch — and only
  /// once the caller knows the user is authenticated and the right shell
  /// (founder/staff) is about to be shown, never before (see main.dart's
  /// StartupGate, the only caller).
  Future<void> checkInitialMessage({required bool isStaff}) async {
    if (_initialMessageChecked) return;
    _initialMessageChecked = true;
    try {
      final message = await FirebaseMessaging.instance.getInitialMessage();
      if (message != null) _handleTap(message.data);
    } catch (e) {
      debugPrint('[push] getInitialMessage failed: $e');
    }
  }

  Future<void> _initLocalNotifications() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _local.initialize(
      settings: const InitializationSettings(android: androidInit),
      onDidReceiveNotificationResponse: _handleLocalTap,
    );
    const channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: 'Approvals waiting, decisions made, and daily reminders.',
      importance: Importance.high,
    );
    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  /// flutter_local_notifications only ever hands a tap callback a string
  /// payload, never the original RemoteMessage — so _showWhileForeground
  /// below stashes the message's data map as JSON, and this reverses that.
  void _handleLocalTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload == null || payload.isEmpty) return;
    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      _handleTap(data.map((k, v) => MapEntry(k, v?.toString() ?? '')));
    } catch (e) {
      debugPrint('[push] could not decode local notification payload: $e');
    }
  }

  /// One place that turns a notification's data (`type`/`ref`/`screen` — see
  /// fire() in src/lib/push/notify.ts) into in-app navigation, whether the
  /// tap came from the system tray (killed or backgrounded) or from the
  /// in-app banner shown by _showWhileForeground. Best-effort: a `screen`
  /// this build doesn't recognise, or one with no precise destination yet,
  /// is a documented gap — it simply does nothing rather than guessing a
  /// route that doesn't exist.
  void _handleTap(Map<String, dynamic> data) {
    final screen = (data['screen'] ?? '').toString();
    final ref = (data['ref'] ?? '').toString();
    final context = navigatorKey.currentContext;
    final navigator = navigatorKey.currentState;
    if (context == null || navigator == null) return;
    final isStaff = context.read<AuthProvider>().isStaff;

    if (screen == 'UPDATE_AVAILABLE') {
      // Not a navigation — runs the same check-and-install flow as the About
      // screen's "Check for updates" button. Fetches fresh rather than
      // trusting the notification's own payload, so a stale/delayed tap
      // never offers an already-superseded build.
      UpdateService.instance.checkForUpdate().then((info) {
        final ctx = navigatorKey.currentContext;
        if (info != null && ctx != null && ctx.mounted) showUpdateDialog(ctx, info);
      });
      return;
    }

    Widget? target;
    switch (screen) {
      case 'APPROVALS':
        // Founder-only destination regardless of who is signed in on this
        // device — matches notifyFounderApproval, which only ever pages the
        // founder's token.
        target = ApprovalsScreen(highlightItemId: ref.isEmpty ? null : ref);
        break;
      case 'MY_REQUESTS':
        target = MyRequestsScreen(highlightItemId: ref.isEmpty ? null : ref);
        break;
      case 'TEACHERS':
        target = ref.isEmpty ? null : TeacherProfileScreen(teacherId: ref, staff: isStaff);
        break;
      case 'INQUIRIES':
        target = ref.isEmpty ? InquiriesScreen() : InquiryProfileScreen(inquiryId: ref);
        break;
      case 'STUDENT_PROFILE':
        // No lightweight studentId -> Student lookup is wired here yet, and
        // StudentProfileScreen needs the full Student object — land on the
        // list rather than guess. Known gap, see push_service.dart report.
        target = StudentsScreen(staff: isStaff);
        break;
      case 'PAYOUTS':
        target = const PayoutPreviewScreen();
        break;
      case 'TIMETABLE':
        target = TimetableScreen(staff: isStaff);
        break;
      case 'TODAYS_CLASSES':
        // Unlike the shell-embedded screens above, this one has no Scaffold
        // of its own (it expects the bottom-nav shell to supply the AppBar
        // and chrome) -- pushed bare, it renders with no app bar and no way
        // back to the rest of the app. Same wrapper dashboard_screen.dart
        // already uses when it pushes this screen outside the shell.
        target = Scaffold(appBar: AppBar(title: const Text("Today's Classes")), body: const TodaysClassesScreen());
        break;
      case 'SCHOOL_INVOICE':
        target = SchoolInvoiceScreen(staff: isStaff);
        break;
      case 'EXPENSES':
        target = ExpensesScreen(staff: isStaff);
        break;
      case 'RECEIPTS':
        target = ReceiptsScreen(staff: isStaff);
        break;
      case 'HOME':
      default:
        // Nothing more specific to do — same as today's behaviour.
        return;
    }
    if (target == null) return;
    navigator.push(MaterialPageRoute(builder: (_) => target!));
  }

  /// Android does not show a "notification" payload's system banner while
  /// the app is in the foreground (by design) — show it ourselves so
  /// foreground, background and killed all feel the same to the operator.
  void _showWhileForeground(RemoteMessage message) {
    final n = message.notification;
    if (n == null) return;
    _local.show(
      id: message.hashCode,
      title: n.title,
      body: n.body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      // Stashed so a tap on this self-shown banner can deep-link too —
      // flutter_local_notifications only ever gives the tap callback a
      // string payload, never the original RemoteMessage/data map.
      payload: message.data.isEmpty ? null : jsonEncode(message.data),
    );
  }

  Future<void> _registerCurrentToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _register(token);
    } catch (e) {
      debugPrint('[push] could not read the device token: $e');
    }
  }

  Future<void> _register(String token) async {
    final api = _api;
    if (api == null) return;
    try {
      await api.registerPushToken(fcmToken: token, platform: Platform.isIOS ? 'ios' : 'android');
      _registeredToken = token;
    } catch (e) {
      debugPrint('[push] register failed (will retry next launch): $e');
    }
  }

  /// Called on sign-out, so a shared or handed-back device stops receiving
  /// this session's notifications once someone else signs in.
  Future<void> stop() async {
    final token = _registeredToken;
    final api = _api;
    _registeredToken = null;
    if (token == null || api == null) return;
    try {
      await api.unregisterPushToken(token);
    } catch (_) {
      // Best-effort: the server also drops a token the moment a send to it fails.
    }
  }
}
