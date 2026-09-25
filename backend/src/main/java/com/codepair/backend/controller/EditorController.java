package com.codepair.backend.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class EditorController {

    private final Map<String, String> roomStorage = new HashMap<>();
    private final RestTemplate restTemplate = new RestTemplate();

    private static final String JDOODLE_API_URL = "https://api.jdoodle.com/v1/execute";
    private static final String CLIENT_ID = "7e9cf4bd6ed062288b4e03240da30ac4"; // Replace with your client ID
    private static final String CLIENT_SECRET = "1e29253780539c936eddde9ecf624b16b70836dbc05f8af1faac46114ad18aad"; // Replace with your client secret

    public EditorController() {
        // Pre-create default room
        roomStorage.put("default-room", "public class Solution {\n    public static void main(String[] args) {\n        System.out.println(\"Welcome to CodePair Studio!\");\n    }\n}");
    }

    @MessageMapping("/code/{roomId}")
    @SendTo("/topic/code/{roomId}")
    public String handleCodeUpdate(@DestinationVariable String roomId, @Payload String code) {
        roomStorage.put(roomId, code);
        return code;
    }

    @PostMapping("/api/room/create")
    public Map<String, String> createRoom() {
        String newRoomId = UUID.randomUUID().toString().substring(0, 8);
        String defaultCode = "public class Solution {\n    public static void main(String[] args) {\n        System.out.println(\"Welcome to Room: " + newRoomId + "\");\n    }\n}";
        roomStorage.put(newRoomId, defaultCode);
        
        Map<String, String> response = new HashMap<>();
        response.put("roomId", newRoomId);
        response.put("code", defaultCode);
        return response;
    }

    @GetMapping("/api/room/{roomId}")
    public ResponseEntity<Map<String, String>> getRoomCode(@PathVariable String roomId) {
        Map<String, String> response = new HashMap<>();
        
        if (!roomStorage.containsKey(roomId)) {
            response.put("error", "Room does not exist.");
            return ResponseEntity.status(404).body(response);
        }
        
        response.put("code", roomStorage.get(roomId));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/execute")
    public Map<String, String> executeCode(@RequestBody Map<String, String> payload) {
        String code = payload.get("code");
        String language = payload.get("language");
        
        Map<String, String> result = new HashMap<>();
        
        try {
            String jdoodleLang = "java";
            String versionIndex = "4";
            
            if ("python".equalsIgnoreCase(language)) {
                jdoodleLang = "python3";
                versionIndex = "3";
            } else if ("javascript".equalsIgnoreCase(language)) {
                jdoodleLang = "nodejs";
                versionIndex = "4";
            } else if ("cpp".equalsIgnoreCase(language)) {
                jdoodleLang = "cpp";
                versionIndex = "5";
            }

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("clientId", CLIENT_ID);
            requestBody.put("clientSecret", CLIENT_SECRET);
            requestBody.put("script", code);
            requestBody.put("language", jdoodleLang);
            requestBody.put("versionIndex", versionIndex);

            @SuppressWarnings("unchecked")
            Map<String, Object> apiResponse = restTemplate.postForObject(JDOODLE_API_URL, requestBody, Map.class);

            if (apiResponse != null && apiResponse.containsKey("output")) {
                result.put("output", (String) apiResponse.get("output"));
            } else {
                result.put("output", "Error: Received empty response from execution sandbox.");
            }

        } catch (Exception e) {
            result.put("output", ">>> [SANDBOX ERROR]: " + e.getMessage());
        }
        
        return result;
    }
}