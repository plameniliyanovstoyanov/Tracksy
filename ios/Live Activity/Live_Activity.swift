//
//  Live_Activity.swift
//  Live Activity
//
//  Created by Plamen Stoyanov on 2.10.25.
//

import WidgetKit
import SwiftUI
import ActivityKit

struct TracksyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TracksyAttributes.self) { context in
            // Lock Screen UI
            VStack {
                Text("Скорост: \(context.state.speed) km/h")
                Text("Средна: \(context.state.average, specifier: "%.1f") km/h")
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    Text("Скорост: \(context.state.speed) km/h")
                }
            } compactLeading: {
                Text("\(context.state.speed)")
            } compactTrailing: {
                Text("km/h")
            } minimal: {
                Text("\(context.state.speed)")
            }
        }
    }
}
