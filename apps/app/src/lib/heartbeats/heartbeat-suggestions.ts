const getHeartbeatSuggestions = (monitor: {
  isPaused: boolean;
  status: string;
  lastCheckInAt: Date | string | null;
  destinationIds: string[];
}) => {
  const suggestions: Array<{ label: string; prompt: string }> = [];
  if (monitor.isPaused)
    suggestions.push({
      label: "Explain what happens when I resume this heartbeat.",
      prompt:
        "Review this paused heartbeat. Explain what resuming it would do and whether it is overdue. Do not change it yet.",
    });
  else if (!monitor.lastCheckInAt)
    suggestions.push({
      label: "Help me send the first check-in from my job.",
      prompt:
        "Help me connect my job to this heartbeat. Ask how and where the job runs, then show where to send the check-in after a successful run. Do not send a check-in for me.",
    });
  else if (monitor.status === "missed" || monitor.status === "grace")
    suggestions.push({
      label:
        monitor.status === "missed"
          ? "Help me investigate why this heartbeat missed a check-in."
          : "Help me investigate why this heartbeat is running late.",
      prompt:
        "Investigate this heartbeat's late or missing check-in using its recent check-ins, incidents, and relevant app logs. Explain what the evidence shows and what I should check next. Do not assume the cause or change the monitor.",
    });
  else
    suggestions.push({
      label: "Check whether this job has been checking in reliably.",
      prompt:
        "Review this heartbeat's recent check-in history and incidents. Tell me whether the job has been checking in reliably and highlight any gaps, using actual timestamps.",
    });
  suggestions.push({
    label: "Review the interval and grace period for this job.",
    prompt:
      "Review this heartbeat's expected interval and grace period against its check-in history. Ask about the job's schedule and usual run time if needed. Explain any recommended changes before applying them.",
  });
  suggestions.push(
    monitor.destinationIds.length
      ? {
          label: "Check who gets notified when this job stops checking in.",
          prompt:
            "Review the notification destinations configured for this heartbeat. Explain who or what gets notified when it misses a check-in. Do not send a test notification or make changes.",
        }
      : {
          label: "Help me add notifications for missed check-ins.",
          prompt:
            "Help me choose notifications for this heartbeat. Check the app's existing notification destinations first and suggest one to reuse. If none fits, explain how to create one and ask for the required details. Do not invent recipients or webhook URLs.",
        },
  );
  return suggestions;
};

export { getHeartbeatSuggestions };
