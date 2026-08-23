import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

export function AnimatedSplashOverlay() {
  return null;
}

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <View style={styles.background}>
        <Text style={styles.logoEmoji}>🤰</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: 100,
  },
  background: {
    borderRadius: 30,
    backgroundColor: '#dc2626',
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  logoEmoji: {
    fontSize: 44,
  },
});
