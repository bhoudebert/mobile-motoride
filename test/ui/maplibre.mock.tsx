import { createContext, forwardRef, useContext, useImperativeHandle, type ReactNode } from "react";
import { View } from "react-native";

/** Fake MapLibre: renders its children, records the props and exposes the camera and map calls. */
export const camera = { easeTo: jest.fn(), fitBounds: jest.fn() };
export const mapApi = {
  getZoom: jest.fn(() => Promise.resolve(12)),
  getCenter: jest.fn(() => Promise.resolve([3.2, 50.45])),
};
export const lastMap: { props: any } = { props: null };
export const sources: Record<string, any> = {};
/** The props each layer was drawn with, by id. */
export const layers: Record<string, any> = {};

export const Map = forwardRef(function Map(props: any, ref) {
  lastMap.props = props;
  useImperativeHandle(ref, () => mapApi);
  return <View testID="map">{props.children}</View>;
});

export const Camera = forwardRef(function Camera(_props: any, ref) {
  useImperativeHandle(ref, () => camera);
  return null;
});

const InSource = createContext(false);

/** Like MapLibre v11, the source hands itself to its children: a Layer outside one has no source. */
export function GeoJSONSource({ id, data, children }: { id: string; data: unknown; children?: ReactNode }) {
  sources[id] = data;
  return (
    <InSource.Provider value={true}>
      <View testID={`source-${id}`}>{children}</View>
    </InSource.Provider>
  );
}

export function Layer(props: { id: string; source?: string; [key: string]: unknown }) {
  const { id, source } = props;
  layers[id] = props;
  if (!useContext(InSource) && !source) throw new Error(`Layer ${id} is not inside a source and names none`);
  return <View testID={`layer-${id}`} />;
}
export const Images = () => null;
export const UserLocation = () => null;

/** Fake offline packs: kept in memory, the test pushes their progress. */
export const offline = {
  packs: [] as any[],
  progress: [] as Array<(pack: any, status: any) => void>,
  errors: [] as Array<(pack: any, error: any) => void>,
  failCreate: false,
};
export const OfflineManager = {
  getPacks: jest.fn(async () => offline.packs),
  createPack: jest.fn(async (options: any, onProgress: any, onError: any) => {
    if (offline.failCreate) throw new Error("no space");
    const pack = {
      id: `pack-${offline.packs.length + 1}`,
      metadata: options.metadata,
      state: "active",
      status: async () => ({ state: pack.state, percentage: 0 }),
    };
    offline.packs.push(pack);
    offline.progress.push(onProgress);
    offline.errors.push(onError);
    return pack;
  }),
  deletePack: jest.fn(async (id: string) => {
    offline.packs = offline.packs.filter((p) => p.id !== id);
  }),
};

export function resetMapMock() {
  offline.packs = [];
  offline.progress = [];
  offline.errors = [];
  offline.failCreate = false;
  OfflineManager.getPacks.mockClear();
  OfflineManager.createPack.mockClear();
  OfflineManager.deletePack.mockClear();
  camera.easeTo.mockClear();
  camera.fitBounds.mockClear();
  lastMap.props = null;
  for (const k of Object.keys(sources)) delete sources[k];
  for (const k of Object.keys(layers)) delete layers[k];
}
