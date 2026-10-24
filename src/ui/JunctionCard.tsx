import { StyleSheet, Text, View } from "react-native";
import type { LaneTurn, PreparedJunction } from "../core/types.ts";
import { colors, fonts, themed } from "./theme.ts";

type Roundabout = Extract<PreparedJunction, { kind: "roundabout" }>;
type Lanes = Extract<PreparedJunction, { kind: "lanes" }>;

const SIZE = 164;
const CENTRE = SIZE / 2;
const RING = 28;
const SPOKE = 28;

/** The ring, a spoke per exit in its true direction (entry at the bottom), the exit to take filled and numbered. */
function RoundaboutDiagram({ junction }: { junction: Roundabout }) {
  return (
    <View style={styles.diagram} testID="roundabout-diagram">
      <View style={styles.ring} />
      <Spoke deg={180} take={false} entry />
      {junction.exits.map((deg, i) => (
        <Spoke key={i} deg={deg} take={i + 1 === junction.exit} number={i + 1} />
      ))}
    </View>
  );
}

function Spoke({ deg, take, number, entry }: { deg: number; take: boolean; number?: number; entry?: boolean }) {
  const width = take ? 12 : entry ? 8 : 6;
  return (
    // A zero-size pivot at the centre of the ring, turned to the exit's bearing, carries its spoke and its disc.
    <View style={[styles.pivot, { transform: [{ rotate: `${deg}deg` }] }]}>
      <View
        testID={entry ? "roundabout-entry" : take ? `exit-${number}-take` : `exit-${number}`}
        style={[
          styles.spoke,
          { left: -width / 2, width, top: -(RING + SPOKE) },
          take ? styles.spokeTake : entry ? styles.spokeEntry : styles.spokeOther,
        ]}
      />
      {number ? (
        <View
          style={[
            styles.disc,
            take ? styles.discTake : styles.discOther,
            // Upright whatever the spoke's angle.
            { top: -(RING + SPOKE + 24), transform: [{ rotate: `${-deg}deg` }] },
          ]}
        >
          <Text style={[styles.discText, { color: take ? colors.onSignal : colors.mossText }]}>{number}</Text>
        </View>
      ) : null}
    </View>
  );
}

const ARROW: Record<LaneTurn, string> = {
  left: "↰",
  slight_left: "↖",
  through: "↑",
  slight_right: "↗",
  right: "↱",
  uturn: "↶",
};

/** The lanes side by side, the left lane on the left: the ones to take filled, the others only outlined. */
function LanesDiagram({ junction }: { junction: Lanes }) {
  return (
    <View style={styles.lanes} testID="lanes-diagram">
      {Array.from({ length: junction.count }, (_, i) => {
        const take = junction.use.includes(i);
        return (
          <View
            key={i}
            testID={take ? `lane-${i}-take` : `lane-${i}`}
            style={[styles.lane, take ? styles.laneTake : styles.laneOther]}
          >
            <Text style={[styles.laneArrow, { color: take ? colors.onSignal : colors.mossMuted }]}>
              {ARROW[junction.turns?.[i] ?? "through"]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** What the rider has to do at the next roundabout or on the lanes ahead; the instruction says it in words too. */
export function JunctionCard({ junction }: { junction: PreparedJunction }) {
  return (
    // A zero-height anchor on the top edge of the panel: the card stands on it, whatever its own height.
    <View style={styles.anchor} pointerEvents="none" testID="junction-anchor">
      <View
        style={styles.card}
        testID="junction-card"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {junction.kind === "roundabout" ? (
          <RoundaboutDiagram junction={junction} />
        ) : (
          <LanesDiagram junction={junction} />
        )}
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // Above the bottom panel, at its left: the map controls are on the right.
    anchor: { position: "absolute", left: 12, top: -12, height: 0 },
    card: {
      position: "absolute",
      bottom: 0,
      left: 0,
      backgroundColor: colors.moss,
      borderRadius: 8,
      padding: 8,
    },
    diagram: { width: SIZE, height: SIZE },
    ring: {
      position: "absolute",
      left: CENTRE - RING,
      top: CENTRE - RING,
      width: RING * 2,
      height: RING * 2,
      borderRadius: RING,
      borderWidth: 6,
      borderColor: colors.mossMuted,
    },
    pivot: { position: "absolute", left: CENTRE, top: CENTRE, width: 0, height: 0 },
    spoke: { position: "absolute", height: SPOKE, borderRadius: 3 },
    spokeTake: { backgroundColor: colors.signal },
    spokeOther: { backgroundColor: colors.mossMuted, opacity: 0.55 },
    spokeEntry: { backgroundColor: colors.mossText },
    disc: {
      position: "absolute",
      left: -12,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    discTake: { backgroundColor: colors.signal },
    discOther: { borderWidth: 2, borderColor: colors.mossMuted },
    discText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18 },
    lanes: { flexDirection: "row", gap: 6, padding: 4 },
    lane: { width: 40, height: 76, borderRadius: 4, alignItems: "center", justifyContent: "center", borderWidth: 3 },
    laneTake: { backgroundColor: colors.signal, borderColor: colors.signal },
    laneOther: { borderColor: colors.mossMuted, opacity: 0.8 },
    laneArrow: { fontFamily: fonts.bold, fontSize: 28 },
  }),
);
