export function prepareSpeechSynthesis(speechSynthesis) {
  speechSynthesis?.resume?.();
}

export async function invokeNativeSpeech(invokeFn, text, accent) {
  try {
    await invokeFn("speak_native", { text, accent });
    return true;
  } catch {
    return false;
  }
}
