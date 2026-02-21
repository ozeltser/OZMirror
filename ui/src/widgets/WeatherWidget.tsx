/**
 * WeatherWidget — displays current weather conditions.
 * Updated in real-time via WebSocket; falls back to REST polling every 10 min.
 */

import React, { useState, useCallback } from 'react';
import { useModuleData } from '../hooks/useModuleData';
import { useModuleEvents } from '../hooks/useModuleEvents';
import styles from './WeatherWidget.module.css';

interface WeatherData {
  city: string;
  country: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  description: string;
  icon: string;
  fetchedAt: number;
}

// REST endpoint returns { instanceId, data: WeatherData }
interface WeatherResponse {
  instanceId: string;
  data: WeatherData;
  message?: string;
}

interface WeatherWidgetProps {
  instanceId: string;
  isEditMode: boolean;
  config: {
    units?: 'metric' | 'imperial';
    showFeelsLike?: boolean;
    showHumidity?: boolean;
    showWind?: boolean;
  };
}

// Map OWM icon codes to emoji
function iconToEmoji(icon: string): string {
  const code = icon.replace(/[dn]$/, '');
  const isNight = icon.endsWith('n');
  const map: Record<string, string> = {
    '01': isNight ? '🌙' : '☀️',
    '02': isNight ? '🌤' : '🌤',
    '03': '⛅',
    '04': '☁️',
    '09': '🌧',
    '10': isNight ? '🌧' : '🌦',
    '11': '⛈',
    '13': '🌨',
    '50': '🌫',
  };
  return map[code] ?? '🌡';
}

function unitSymbol(units: 'metric' | 'imperial'): string {
  return units === 'metric' ? '°C' : '°F';
}

function windLabel(units: 'metric' | 'imperial'): string {
  return units === 'metric' ? 'm/s' : 'mph';
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ instanceId, config }) => {
  const units = config.units ?? 'metric';
  const showFeelsLike = config.showFeelsLike ?? true;
  const showHumidity = config.showHumidity ?? true;
  const showWind = config.showWind ?? true;

  const { data: restData, isLoading, error } = useModuleData<WeatherResponse>(
    'weather',
    instanceId,
    600_000 // poll every 10 min as fallback
  );

  const [realtimeData, setRealtimeData] = useState<WeatherData | null>(null);

  const handleEvent = useCallback((data: WeatherData) => {
    setRealtimeData(data);
  }, []);

  useModuleEvents<WeatherData>('weather', instanceId, handleEvent, 'data');

  // REST gives us { instanceId, data: WeatherData }; WebSocket gives WeatherData directly
  const weather = realtimeData ?? restData?.data ?? null;

  if (isLoading && !weather) {
    return (
      <div className={styles.widget}>
        <span className={styles.loading}>Loading weather…</span>
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className={styles.widget}>
        <span className={styles.error}>Weather unavailable</span>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className={styles.widget}>
        <span className={styles.empty}>No weather data</span>
      </div>
    );
  }

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.icon}>{iconToEmoji(weather.icon)}</span>
        <div className={styles.location}>
          <span className={styles.city}>{weather.city}</span>
          <span className={styles.country}>{weather.country}</span>
        </div>
      </div>

      <div className={styles.temp}>
        {weather.temp}{unitSymbol(units)}
      </div>

      <div className={styles.description}>{weather.description}</div>

      <div className={styles.details}>
        {showFeelsLike && (
          <span className={styles.detail}>
            Feels {weather.feelsLike}{unitSymbol(units)}
          </span>
        )}
        {showHumidity && (
          <span className={styles.detail}>
            💧 {weather.humidity}%
          </span>
        )}
        {showWind && (
          <span className={styles.detail}>
            💨 {weather.windSpeed} {windLabel(units)}
          </span>
        )}
      </div>
    </div>
  );
};

export default WeatherWidget;
