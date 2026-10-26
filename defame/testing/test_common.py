import io
import sys
from types import SimpleNamespace

import pytest

from defame.common import logger, Claim, Report, Label
from defame.common.logger import Logger
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


def test_logger_uses_utf8_stdout_for_unicode(monkeypatch):
    buffer = io.BytesIO()
    stdout = io.TextIOWrapper(buffer, encoding="cp1252", write_through=True)
    monkeypatch.setattr(sys, "stdout", stdout)

    custom_logger = Logger()
    stream_handler = next(handler for handler in custom_logger.logger.handlers if hasattr(handler, "stream"))

    assert stream_handler.stream.encoding == "utf-8"
    custom_logger.info("Delhi is the capital of India\u202f— and it works.")
    assert b"Delhi is the capital of India" in buffer.getvalue()


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


def test_groq_model_retries_failed_calls_until_success():
    class ParsingPrompt(Prompt):
        def extract(self, response):
            return {"verdict": response}

    class RetryGroqModel(GroqModel):
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
            self._attempt = 0

        def count_tokens(self, prompt):
            return 1

        def _generate(self, prompt, **kwargs):
            self._attempt += 1
            if self._attempt == 1:
                return ""
            return "supported"

    model = RetryGroqModel()
    result = model.generate(ParsingPrompt(text="claim"), max_attempts=3)

    assert result == {"verdict": "supported"}
    assert model._attempt == 2


def test_judge_uses_default_class_definitions_when_not_provided():
    llm = SimpleNamespace(generate=lambda prompt: {"verdict": Label.SUPPORTED, "response": "ok"})
    judge = Judge(llm=llm, classes=[Label.SUPPORTED, Label.REFUTED])

    claim = Claim("Paris is the capital of France.")
    doc = Report(claim)

    assert judge.judge(doc, is_final=True) == Label.SUPPORTED


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
