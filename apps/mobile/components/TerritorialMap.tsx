import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import MapView, { Circle, Marker, type Region } from 'react-native-maps'
import type { DeviceCoordinates } from '../lib/report-device'
import type { NearbyTerritorialReport } from '../types/api'

interface TerritorialMapProps {
  center: DeviceCoordinates
  reports: NearbyTerritorialReport[]
  onOpenReport: (reportId: string) => void
}

export function TerritorialMap({ center, reports, onOpenReport }: TerritorialMapProps) {
  const region = useMemo<Region>(() => ({
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: 0.055,
    longitudeDelta: 0.055,
  }), [center.lat, center.lng])

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Circle
          center={{ latitude: center.lat, longitude: center.lng }}
          radius={3000}
          strokeWidth={1}
          strokeColor="rgba(28,61,46,0.45)"
          fillColor="rgba(28,61,46,0.08)"
        />
        {reports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.lat, longitude: report.lng }}
            title={report.title}
            description={`${report.neighborhood ?? 'Sin barrio'} · ${Math.round(report.distance_meters)} m`}
            onCalloutPress={() => onOpenReport(report.id)}
          />
        ))}
      </MapView>
      <View pointerEvents="none" style={styles.legend}>
        <Text style={styles.legendText}>Radio público de 3 km · toca un marcador para abrir el reporte</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 310,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#E6E4DD',
  },
  map: { flex: 1 },
  legend: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendText: {
    color: '#394038',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
})
