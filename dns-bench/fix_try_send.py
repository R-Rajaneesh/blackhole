import re

with open("src/main.rs", "r") as f:
    content = f.read()

# Change build_and_send_response to synchronous (or just not async)
content = content.replace("async fn build_and_send_response", "fn build_and_send_response")
content = content.replace("if let Err(e) = socket.send_to(&response_buffer, src).await {", "if let Err(e) = socket.try_send_to(&response_buffer, src) {")

# Fix fast path to not spawn and not await
fast_path_old = """        if all_cached {
            tokio::task::spawn(async move {
                build_and_send_response(socket_clone, src, header, questions, fast_answers, false).await;
            });
            continue;
        }"""
fast_path_new = """        if all_cached {
            build_and_send_response(socket_clone, src, header, questions, fast_answers, false);
            continue;
        }"""
content = content.replace(fast_path_old, fast_path_new)

# Fix slow path to not await build_and_send_response
slow_path_old = "build_and_send_response(socket_clone, src, header, questions, answers, is_nxdomain).await;"
slow_path_new = "build_and_send_response(socket_clone, src, header, questions, answers, is_nxdomain);"
content = content.replace(slow_path_old, slow_path_new)

with open("src/main.rs", "w") as f:
    f.write(content)
