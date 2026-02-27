export function formatEventLog(
    sessionName: string | null | undefined,
    moduleName: string,
    eventDescription: string
): string {
    const sessionPart = sessionName ? `[${sessionName}] ` : '';
    const modulePart = moduleName ? `[${moduleName}] ` : '';
    const datetime = new Date().toISOString();
    return `${sessionPart}${modulePart}${datetime} - ${eventDescription}`;
}

export default formatEventLog;
