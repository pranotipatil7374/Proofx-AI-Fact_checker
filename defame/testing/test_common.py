import pytest
from types import SimpleNamespace

from defame.common import logger, Claim, Report, Label
from defame.common.modeling import GroqModel
from defame.common.prompt import Prompt
from defame.modules.judge import Judge


def test_logger():
    logger.debug("debug")
    logger.log("log")
    logger.info("info")
    logger.warning("warning")
    logger.error("error")
    logger.critical("critical")
    logger.log_model_comm("model_comm")

    logger.log("Next, only log messages with level WARNING or higher:")
    logger.set_log_level("warning")

    logger.debug("debug")
    logger.log("log")
    logger.info("info")
    logger.warning("warning")
    logger.error("error")
    logger.critical("critical")
    logger.log_model_comm("model_comm")

    logger.set_experiment_dir("test_experiment/")
    logger.warning("This warning should have been logged into a file under 'test_experiment/'.")


def test_judge_handles_string_response_from_llm():
    llm = SimpleNamespace(generate=lambda prompt: "`supported`")
    judge = Judge(
        llm=llm,
        classes=[Label.SUPPORTED, Label.REFUTED],
        class_definitions={
            Label.SUPPORTED: "supported",
            Label.REFUTED: "refuted",
        },
    )

    claim = Claim("Paris is the capital of France.")
    doc = Report(claim)

    verdict = judge.judge(doc, is_final=True)

    assert verdict == Label.SUPPORTED


def test_groq_model_truncates_large_prompt_and_preserves_extractor():
    class ParsingPrompt(Prompt):
        def extract(self, response):
            return {"verdict": response}

    class StubGroqModel(GroqModel):
        provider_max_prompt_tokens = 20

        def __init__(self):
            self.temperature = 0.0
            self.top_p = 0.9
            self.top_k = 50
            self.system_prompt = ""
            self.context_window = 10000
            self.max_prompt_len = 9000
            self.name = "stub_groq"
            self.n_calls = 0
            self.n_input_tokens = 0
            self.n_output_tokens = 0

        def count_tokens(self, prompt):
            return len(str(prompt))

        def _generate(self, prompt, **kwargs):
            self.sent_prompt = prompt
            return "supported"

    model = StubGroqModel()
    result = model.generate(ParsingPrompt(text="claim " + "evidence " * 50))

    assert len(str(model.sent_prompt)) <= model.provider_max_prompt_tokens
    assert result == {"verdict": "supported"}
