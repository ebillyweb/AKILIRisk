import * as LocalAuthentication from 'expo-local-authentication';

/** Whether the device has enrolled biometrics we can prompt for. */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

/**
 * Prompts for Face ID / Touch ID / fingerprint. Returns true on success.
 * Falls through to the OS device-passcode prompt where allowed.
 */
export async function promptBiometric(
  reason = 'Unlock AkiliRisk',
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    fallbackLabel: 'Use device passcode',
    disableDeviceFallback: false,
  });
  return result.success;
}
