import { ARRIVED_M } from "../core/navigator.ts";
import { CHECKPOINT_MS, keeps, pointOf, type RideMeta, type TrackPoint } from "../core/recording.ts";
import type { MotionReading } from "../core/instruments.ts";
import type { Fix, RoadbookOrigin } from "../core/types.ts";
import { clearCheckpoint, keepUnsaved, saveRide, writeCheckpoint, type Checkpoint } from "./ridesStore.ts";

/**
 * The track of one GPS ride (spec ride-recording): fixes go in, a checkpoint is written about once a minute, and when the
 * ride ends the track is saved as it is, finished or not.
 */
export class RideRecorder {
  private points: TrackPoint[] = [];
  private completed = false;
  private lastCheckpointAt = 0;
  private readonly roadbook: { id: string; name: string; origin?: RoadbookOrigin };
  private readonly startedAt: number;

  constructor(roadbook: { id: string; name: string; origin?: RoadbookOrigin }, startedAt: number) {
    this.roadbook = roadbook;
    this.startedAt = startedAt;
  }

  /** A fix, with how much of the roadbook is left at it and the phone's motion readings of the moment, when there are. */
  add(fix: Fix, remainingM: number, motion: MotionReading | null = null): void {
    if (keeps(this.points.at(-1) ?? null, fix)) this.points.push(pointOf(fix, motion));
    if (remainingM <= ARRIVED_M) this.completed = true;
    if (fix.time - this.lastCheckpointAt >= CHECKPOINT_MS && this.points.length > 1) {
      this.lastCheckpointAt = fix.time;
      void writeCheckpoint(this.snapshot());
    }
  }

  private snapshot(): Checkpoint {
    return {
      roadbookId: this.roadbook.id,
      roadbookName: this.roadbook.name,
      ...(this.roadbook.origin ? { origin: this.roadbook.origin } : {}),
      startedAt: this.startedAt,
      completed: this.completed,
      points: this.points,
    };
  }

  /**
   * The ride is over: save the track; null when it was too short to be a ride, or when it could not be saved. The checkpoint
   * goes only once the track is on the phone: if the save fails, what was written while the ride ran is kept, put aside so the
   * next ride cannot replace it, and saved at the next launch (spec ride-recording).
   */
  async finish(): Promise<RideMeta | null> {
    const last = this.points.at(-1);
    try {
      const meta = await saveRide(
        this.snapshot(),
        last?.time ?? this.startedAt,
        this.completed ? "completed" : "stopped",
      );
      await clearCheckpoint();
      return meta;
    } catch (e) {
      console.warn("The ride could not be saved; it is kept and saved at the next launch", e);
      await keepUnsaved(this.startedAt);
      return null;
    }
  }
}
