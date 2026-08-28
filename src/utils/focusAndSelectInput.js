export function focusAndSelectInput(input) {
  if (!input) return false;
  input.focus();
  input.select();
  return true;
}
