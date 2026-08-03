const rules = [
  {
    words: ["설명", "대사", "직접", "말해"],
    tag: "설명과잉",
    learning: "화면이 이미 전달한 의미를 대사로 다시 설명하지 않는다.",
    action: "중복되는 대사를 덜어내고 장면의 침묵을 확인한다."
  },
  {
    words: ["상징", "기교", "의도", "티"],
    tag: "기교노출",
    learning: "상징이 경험보다 먼저 보이면 표현을 한 단계 덜어낸다.",
    action: "상징 하나를 제거하고 인물과 공간의 변화만 남긴다."
  },
  {
    words: ["여백", "침묵", "빈", "좋아"],
    tag: "여백성공",
    learning: "감정이 충분히 전달된 순간에는 설명을 추가하지 않는다.",
    action: "현재의 침묵과 빈 공간을 유지한다."
  },
  {
    words: ["느낌", "감각", "안 느껴", "약해"],
    tag: "감각부재",
    learning: "개념을 설명하기 전에 몸으로 느낄 수 있는 변화를 보여준다.",
    action: "온도, 거리, 소리, 사물 중 하나를 장면에 구체화한다."
  }
];

export function analyzeFeedback(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const matched = rules.find((rule) =>
    rule.words.some((word) => normalized.includes(word))
  );
  return matched ?? {
    tag: "추가 관찰",
    learning: "한 번의 의견은 원칙으로 고정하지 않고 다음 수정 결과와 함께 관찰한다.",
    action: "수정본을 만든 뒤 같은 문제가 남는지 비교한다."
  };
}
