from langchain_core.messages import AIMessage, HumanMessage

from agent_server.graph import graph, respond


def test_graph_returns_native_ai_message() -> None:
    result = graph.invoke({"messages": [HumanMessage(content="Hello")]})

    assert [message.type for message in result["messages"]] == ["human", "ai"]
    assert result["messages"][-1].content == "Reference response for turn 1: Hello"


def test_response_counts_human_messages_from_existing_state() -> None:
    result = respond(
        {
            "messages": [
                HumanMessage(content="Hello"),
                AIMessage(content="Reference response for turn 1: Hello"),
                HumanMessage(content="Second turn"),
            ]
        }
    )

    assert result["messages"][0].content == "Reference response for turn 2: Second turn"
