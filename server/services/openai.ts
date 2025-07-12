import OpenAI from 'openai';

class OpenAIService {
  private openai: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async analyzeMessages(messages: any[]): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const messageData = messages.map(msg => ({
        topic: msg.topic,
        payload: msg.payload,
        extractedKeys: msg.extractedKeys,
        timestamp: msg.timestamp
      }));

      const systemPrompt = `You are an AI assistant analyzing IoT sensor data for patterns, anomalies, and insights. Analyze the provided MQTT message data and return insights in JSON format.`;

      const userPrompt = `Analyze these MQTT messages for patterns, anomalies, trends, and optimization opportunities:
      
${JSON.stringify(messageData, null, 2)}

Return insights as JSON array with this structure:
[{
  "type": "anomaly|pattern|trend|optimization",
  "title": "Brief title",
  "description": "Detailed description",
  "severity": "low|medium|high",
  "confidence": 0.0-1.0,
  "suggestions": ["suggestion1", "suggestion2"]
}]`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0].message.content;
      const parsed = JSON.parse(response || '{"insights": []}');
      
      return parsed.insights || parsed;
    } catch (error) {
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.openai;
  }
}

export const openAIService = new OpenAIService();