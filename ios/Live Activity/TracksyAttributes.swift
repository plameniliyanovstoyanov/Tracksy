import ActivityKit

public struct TracksyAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var speed: Int
        public var average: Double
    }

    public var name: String
}


