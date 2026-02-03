import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, G, Path, Text as SvgText } from 'react-native-svg';

interface SpliterLogoProps {
  size?: number;
  style?: ViewStyle;
}

/**
 * Spliter brand mark - SVG logo component
 * Use for: welcome screen centerpiece, home header, app icon reference
 */
export const SpliterLogo: React.FC<SpliterLogoProps> = ({ size = 128, style }) => {
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 256 256" fill="none">
        <Rect width="256" height="256" rx="56" fill="#0F0F1A" />
        <G stroke="#7C6BFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M128 64 L128 32" />
          <Path d="M118 44 L128 32 L138 44" />
          <Path d="M192 128 L224 128" />
          <Path d="M212 118 L224 128 L212 138" />
          <Path d="M128 192 L128 224" />
          <Path d="M118 214 L128 224 L138 214" />
          <Path d="M64 128 L32 128" />
          <Path d="M44 118 L32 128 L44 138" />
        </G>
        <SvgText
          x="128"
          y="170"
          textAnchor="middle"
          fontSize="120"
          fontWeight="700"
          fill="#FFFFFF"
        >
          S
        </SvgText>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
