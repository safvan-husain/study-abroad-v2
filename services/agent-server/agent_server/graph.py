from langchain_core.messages import AIMessage
from langgraph.graph import END, START, MessagesState, StateGraph


def respond(state: MessagesState) -> dict:
    human_messages = [message for message in state["messages"] if message.type == "human"]
    latest = human_messages[-1].content if human_messages else ""
    return {"messages": [AIMessage(content=f"Reference response for turn {len(human_messages)}: {latest}")]}


builder = StateGraph(MessagesState)
builder.add_node("respond", respond)
builder.add_edge(START, "respond")
builder.add_edge("respond", END)
graph = builder.compile()
