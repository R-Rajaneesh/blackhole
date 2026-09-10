import { NULL, QuestionClass, QuestionType, type TCreateQuestion } from "../types";
import encodeDomain from "./encodeDomain";

const createQuestion = (QuestionLabel: TCreateQuestion) => {
	return Buffer.from([
		...encodeDomain(`${QuestionLabel.domain}.`),
		NULL,
		QuestionLabel.type === QuestionType.A ? QuestionType.A : QuestionType.AAAA,
		NULL,
		QuestionClass.IN,
	]);
};
export default createQuestion;
