import Expo
import React
import ReactAppDependencyProvider
import UIKit
#if canImport(ActivityKit)
import ActivityKit
#endif

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

#if DEBUG
    // Quick DEBUG-only smoke test for Live Activity
    #if canImport(ActivityKit)
    // startLiveActivity()
    // DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
    //   updateLiveActivity(speed: 70, average: 63.9)
    // }
    // DispatchQueue.main.asyncAfter(deadline: .now() + 12) {
    //   endLiveActivity()
    // }
    #endif
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

// MARK: - Live Activity helpers (App target)
// var tracksyActivity: Activity<TracksyAttributes>? = nil
// func startLiveActivity() {
//   let attributes = TracksyAttributes(name: "Tracksy")
//   let contentState = TracksyAttributes.ContentState(speed: 58, average: 48.2)
//   do {
//     let activity = try Activity<TracksyAttributes>.request(
//       attributes: attributes,
//       contentState: contentState,
//       pushType: nil
//     )
//     tracksyActivity = activity
//     print("Started Live Activity with id: \(activity.id)")
//   } catch {
//     print("Error starting Live Activity: \(error)")
//   }
// }
// func updateLiveActivity(speed: Int, average: Double) {
//   Task {
//     await tracksyActivity?.update(using: TracksyAttributes.ContentState(speed: speed, average: average))
//   }
// }
// func endLiveActivity() {
//   Task {
//     await tracksyActivity?.end(dismissalPolicy: .immediate)
//   }
// }
