/** Assemble contact address in the browser only (keeps it out of static HTML). */
export function contactEmail(): string {
	return atob('aGVsbG9AYWRhbXNpbW1zLnh5eg==');
}
