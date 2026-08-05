const getChatScrollDistanceFromBottom = ({
  scrollHeight,
  clientHeight,
  scrollTop,
}: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}) => scrollHeight - clientHeight - scrollTop;

const isChatScrollNearBottom = (
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number },
  threshold = 10,
) => getChatScrollDistanceFromBottom(metrics) <= threshold;

export { getChatScrollDistanceFromBottom, isChatScrollNearBottom };
