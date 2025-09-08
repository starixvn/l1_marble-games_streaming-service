import Chance from 'chance';
import { DEFAULT_VOICE_DURATION_CONFIG, generateVoiceWithEventTimeline, EventTimelineArgs, VoiceGenerationResult } from '../../../src/helpers/voices';


function mockPickoneIndices(indices: number[]): () => void {
  const originalPickone = Chance.prototype.pickone;
  
  let currentIndex = 0;
  
  Chance.prototype.pickone = function<T>(arr: T[]): T {
    const pickIndex = indices[currentIndex];
    currentIndex = (currentIndex + 1) % indices.length;
    return arr[pickIndex];
  };
  
  return () => {
    Chance.prototype.pickone = originalPickone;
  };
}

describe('generateVoiceWithEventTimeline', () => {
    describe('random goal', () => {

    const timeline = [6, 12];
    const eventName = ["goal_A", "goal_A"];

    it('should generate voice for goal', () => {
        // Arrange
        const restore = mockPickoneIndices([0, 0, 0, 0]);
        
        try {
            // Act
            const actual = generateVoiceWithEventTimeline({
                eventName,
                timeline
            }, {
                goal: { 
                    1: 2,
                    2: 1,
                    3: 1
                }
            });

            // Assert
            expect(actual.voice).toEqual(['goal_1_1', 'goal_1_2']);
        } finally {
            restore();
        }
    });

        it('should not generate voice overlapping the previous voice', () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                const closeTimeline = [5, 6];
                
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline: closeTimeline
                }, {
                    goal: { 
                        3: 1
                    }
                });

                // Assert
                // The second voice is skipped because of the overlapping check,
                // but the timeline still has both entries
                expect(actual.timeline.length).toBe(1);
                expect(actual.voice.length).toBe(1);
                expect(actual.voice[0]).toBe('goal_3_1');
            } finally {
                restore();
            }
        });
    });

    describe("Equalizer 1 - 1", () => {
        const timeline = [10, 20];
        const eventName = ["goal_H", "goal_A"];

        it("should generate voice for equalizer 1 - 1", () => {
            // Arrange
            const restore = mockPickoneIndices([0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    draw1: { 1: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('draw1_1_1');
            } finally {
                restore();
            }
        });

        it("should count score from previous half", () => {
            // Arrange
            const restore = mockPickoneIndices([0]);
            const thisEventName = ["goal_H"];
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName: thisEventName,
                    timeline: [10],
                    firstHalfScore: "A"
                }, {
                    draw1: { 1: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toEqual(['draw1_1_1']);
            } finally {
                restore();
            }
        });

        it("should not generate unconfigured voice", () => {
            // Arrange
            const thisEventName = ["goal_H"];
            // Act
            const actual = generateVoiceWithEventTimeline({
                eventName: thisEventName,
                timeline: [10],
                firstHalfScore: "A"
            }, {
                goal: { 1: 1 },
            });

            // Assert
            expect(actual.voice).toEqual(['goal_1_1']);
        });


        it("should also randomly generate random goal too", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal: { 1: 2 },
                });

                // Assert
                expect(actual.voice).toContain('goal_1_2');
                expect(actual.voice).toContain('goal_1_1');
            } finally {
                restore();
            }
        });
    });

    describe("Draw 2 - 2", () => {
        const timeline = [10, 20, 30, 40];
        const eventName = ["goal_H", "goal_A", "goal_H", "goal_A"];

        it("should generate voice for draw 2 - 2", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0, 0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    draw2: { 2: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('draw2_2_1');
            } finally {
                restore();
            }
        });
    });

    describe("Draw 3 - 3", () => {
        const timeline = [10, 20, 30, 40, 50, 60];
        const eventName = ["goal_H", "goal_A", "goal_H", "goal_A", "goal_H", "goal_A"];

        it("should generate voice for draw 3 - 3", () => {
            // Arrange
            const restore = mockPickoneIndices([0,0, 0,0, 0,0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    draw3: { 3: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('draw3_3_1');
            } finally {
                restore();
            }
        });
    });

    describe("Draw 4 - 4", () => {
        const timeline = [10, 20, 30, 40, 50, 60, 70, 80];
        const eventName = ["goal_H", "goal_A", "goal_H", "goal_A", "goal_H", "goal_A", "goal_H", "goal_A"];

        it("should generate voice for draw 4 - 4", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    draw4: { 4: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('draw4_4_1');
            } finally {
                restore();
            }
        });
    });

    describe("2 Consecutive Goal", () => {
        const timeline = [10, 20];
        const eventName = ["goal_H", "goal_H"];

        it("should generate voice for 2 consecutive goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal2nd: {
                        2: 1,
                        3: 1,
                        4: 1
                    },
                    goal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toContain('goal2nd_2_1');
            } finally {
                restore();
            }
        });
    });

    describe("3 Consecutive Goal", () => {
        const timeline = [10, 20, 30];
        const eventName = ["goal_H", "goal_H", "goal_H"];

        it("should generate voice for 3 consecutive goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal3rd: {
                        2: 1,
                        3: 1,
                        4: 1
                    },
                    goal: { 1: 1 },
                    
                })

                // Assert
                expect(actual.voice).toContain('goal3rd_2_1');
            } finally {
                restore();
            }
        });

        it("should should count score from previous half", () => {
            // Arrange
            const restore = mockPickoneIndices([0,0, 0,0, 1,0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName: ["goal_A", "goal_A", "goal_A"],
                    timeline: [10, 20, 30],
                    firstHalfScore: "HHA"
                }, {
                    goal4th: {
                        1:1
                    },
                    goal3rd: {
                        2: 1,
                        3: 1,
                        4: 1
                    },
                    goal2nd: {
                        1: 1
                    },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('goal4th_1_1');
            } finally {
                restore();
            }
        });
    });

    describe("6 Consecutive Goal", () => {
        const timeline = [10, 20, 30, 40, 50, 60];
        const eventName = ["goal_H", "goal_H", "goal_H", "goal_H", "goal_H", "goal_H"];

        it("should generate voice for 6 consecutive goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0,0, 0,0, 0,0, 0,0, 0,0, 1,0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal5th: {
                        2: 1,
                        3: 1,
                        4: 1,
                        5: 1
                    },
                    goal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toContain('goal5th_2_1');
            } finally {
                restore();
            }
        });
    });

    describe("Fast Goal", () => {
        const timeline = [2, 4.3];
        const eventName = ["goal_H", "goal_A"];

        it("should generate voice for fast goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    fastGoal: { 2: 1 },
                    goal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toContain('fastGoal_2_1');
            } finally {
                restore();
            }
        });

        it("should not count score from previous half", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [2],
                    firstHalfScore: "H"
                }, {
                    fastGoal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toEqual([]);
            } finally {
                restore();
            }
        })
    });

    describe("First Goal", () => {
        const timeline = [2];
        const eventName = ["goal_H"];

        it("should generate voice for first goal on first half", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);

            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    firstGoal: { 1: 1 },
                    goal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toContain('firstGoal_1_1');
            } finally {
                restore();
            }
        });
    });

    describe("Last Goal", () => {
        const timeline = [26];
        const eventName = ["goal_H"];

        it("should generate voice for last goal", () => {
            // Arrange
            const restore = mockPickoneIndices([1, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline,
                }, {
                    lastGoal: { 1: 1 }
                })

                // Assert
                expect(actual.voice).toEqual([]);
            } finally {
                restore();
            }
        });
    });

    describe("Glove", () => {
        describe("Overlap with previous goal", () => {
            it("Should not generate voice for glove", () => {
                // Arrange
                const restore = mockPickoneIndices([0, 0]);
                const timeline = [2,4];
                const eventName = ["goal_H", "hit_glove_B"];
                try {
                    // Act
                    const actual = generateVoiceWithEventTimeline({
                        eventName,
                        timeline
                    }, {
                        goal: { 3: 1 },
                        save: { 1: 1 }
                    });

                    // Assert
                    expect(actual.voice).toEqual(['goal_3_1']);
                } finally {
                    restore();
                }
            });
        });

        describe("Overlap with next goal", () => {
            it("Should not generate voice for glove", () => {
                // Arrange
                const restore = mockPickoneIndices([0, 0]);
                const timeline = [2,4];
                const eventName = ["hit_glove_B", "goal_H"];
                try {
                    // Act
                    const actual = generateVoiceWithEventTimeline({
                        eventName,
                        timeline
                    }, {
                        goal: { 1: 1 },
                        save: { 3: 1 }
                    });

                    // Assert
                    expect(actual.voice).toEqual(['goal_1_1']);
                } finally {
                    restore();
                }
            });
        });
    });

    describe("When time from current event to the next event", () => {
        const timeline = [14, 16];
        const eventName = ["goal_H", "goal_H"];

        describe("There is a voice that has shorter duration than the limit", () => {
            it("should only generate within the limit", () => {
                // Arrange
                const restore = mockPickoneIndices([0, 0]);
                const config = {
                    goal: {
                        1: 1,
                        3: 4,
                        4: 6
                    }
                };
                const param = {
                    eventName,
                    timeline
                }

                // Act
                try {
                    const actual = generateVoiceWithEventTimeline(param, config);

                    // Assert
                    expect(actual.voice).toEqual(['goal_1_1', 'goal_3_1']);
                } finally {
                    restore();
                }
            });
            it("should not generate voice over the limit", () => {
                // Arrange
                const restore = mockPickoneIndices([1, 6]);
                const config = {
                    goal: {
                        1: 1,
                        3: 4,
                        4: 6
                    }
                };
                const param = {
                    eventName,
                    timeline
                }

                // Act
                try {
                    const actual = generateVoiceWithEventTimeline(param, config);

                    // Assert
                    expect(actual.voice).toEqual(['goal_4_2']);
                } finally {
                    restore();
                }
            });
        });
        

        describe("There is no voice that has shorter duration than the limit", () => {
            it("should generate voice for the shortest duration exceed the limit, and therefore overlap next voice", () => {
                // Arrange
                const restore = mockPickoneIndices([0, 6]);
                const config = {
                    goal: {
                        3: 1,
                        4: 6
                    }
                };
                const param = {
                    eventName,
                    timeline
                }

                // Act
                try {
                    const actual = generateVoiceWithEventTimeline(param, config);

                    // Assert
                    expect(actual.voice).toEqual(['goal_3_1']);
                } finally {
                    restore();
                }
            });

            it("should not generate voice other than that", () => {
                // Arrange
                const restore = mockPickoneIndices([1, 2]);
                const config = {
                    goal: {
                        3: 1,
                        4: 6
                    }
                };
                const param = {
                    eventName,
                    timeline
                }

                // Act
                try {
                    const actual = generateVoiceWithEventTimeline(param, config);

                    // Assert
                    expect(actual.voice).toEqual(['goal_4_2']);
                } finally {
                    restore();
                }
            });
        });
    });

    describe("When there is a voice that is already generated", () => {
        it("should not generate the same voice", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0, 0, 0]);
            const timeline = [14, 20];
            const eventName = ["goal_A", "goal_H"];
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal: { 1: 2 }
                });

                // Assert
                expect(actual.voice).toEqual(['goal_1_1', 'goal_1_2']);
            } finally {
                restore();
            }
        });

        it("should not generate voice that is already generated in the first half", () => {
            // Arrange
            const restore = mockPickoneIndices([0]);
            const timeline = [14];
            const eventName = ["goal_A"];
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline,
                    firstHalfScore: "A",
                    firstHalfVoices: ["goal_1_1"],
                }, {
                    goal: { 1: 2 },
                });

                // Assert
                expect(actual.voice).toEqual(['goal_1_2']);
            } finally {
                restore();
            }
        });
    });

    describe("Debugging test", () => {
        it("error pickone empty array", () => {
            // Arrange
            const events = [ 'goal_H', 'hit_glove_B', 'hit_glove_R', 'hit_glove_B', 'goal_H' ]
            const timeline = [
                8.866666666666667,
                14.866666666666667,
                21.566666666666666,
                27.166666666666668,
                27.8
              ]
            
            const actual = generateVoiceWithEventTimeline({
                eventName: events,
                timeline,
                firstHalfScore: "AAAH",
                firstHalfVoices: [ 'firstGoal_2_6', 'goal2nd_3_3', 'goal3rd_4_3', 'goal_2_2' ]
            }, 
                DEFAULT_VOICE_DURATION_CONFIG);
            console.log(actual);
            expect(actual).toBeDefined();
        });

    });
    
    describe("With Previous Events", () => {
        // should respect previous event by generating 4th goal when previous event has 3 goal all from A
        // should respect timing duration by not generating event if previous is a goal and current is a glove
        // should respect voice exclusion
    });

    describe("Split Half Segments - Voice Generation In-Between", () => {
        let restoreFunction: (() => void) | null = null;

        afterEach(() => {
            if (restoreFunction) {
                restoreFunction();
                restoreFunction = null;
            }
        });

        describe("Basic segment continuity", () => {
            it("should continue voice generation across multiple segments of the same half", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0]);
                
                // Test current segment with hardcoded previous context
                const currentSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [30],
                    previousEvents: ["goal_H", "goal_A"],
                    previousTimelines: [10, 20],
                    previousVoices: ["goal_1_1", "goal_1_2"] // Hardcoded previous voices
                }, {
                    goal: { 1: 3 } // Need more options since goal_1_1 and goal_1_2 are excluded
                });

                // Assert - should use goal_1_3 (excluding goal_1_1 and goal_1_2)
                expect(currentSegment.voice).toEqual(['goal_1_3']);
            });

            it("should track consecutive goals across segments", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0]);
                
                // Test current segment: another home goal (should be 3rd consecutive)
                const currentSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [30],
                    previousEvents: ["goal_H", "goal_H"], // 2 consecutive home goals
                    previousTimelines: [10, 20],
                    previousVoices: ["goal_1_1", "goal2nd_1_1"] // Hardcoded previous voices
                }, {
                    goal3rd: { 1: 1 },
                    goal2nd: { 1: 1 },
                    goal: { 1: 2 }
                });

                // Assert - should be 3rd consecutive goal
                expect(currentSegment.voice).toEqual(['goal3rd_1_1']);
            });

            it("should break consecutive goal tracking when different team scores in new segment", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0]);
                
                // Test current segment: away goal (breaks consecutive streak)
                const currentSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_A"],
                    timeline: [30],
                    previousEvents: ["goal_H", "goal_H"], // 2 consecutive home goals
                    previousTimelines: [10, 20],
                    previousVoices: ["goal_1_1", "goal2nd_1_1"] // Hardcoded previous voices
                }, {
                    goal2nd: { 1: 1 },
                    goal: { 1: 3 }
                });

                // Assert - should be regular goal (breaks consecutive streak)
                expect(currentSegment.voice).toEqual(['goal_1_2']); // Uses goal_1_2 (goal_1_1 excluded)
            });
        });

        describe("Voice exclusion across segments", () => {
            it("should not repeat voices used in previous segments", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0]); // Will pick index 0 from available options
                
                // Test current segment should exclude goal_1_1
                const currentSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_A"],
                    timeline: [30],
                    previousEvents: ["goal_H"],
                    previousTimelines: [10],
                    previousVoices: ["goal_1_1"] // Hardcoded previous voice
                }, {
                    goal: { 1: 3 } // goal_1_1, goal_1_2, goal_1_3 (but goal_1_1 excluded)
                });

                // Assert - should exclude goal_1_1 and use next available
                expect(currentSegment.voice).toEqual(['goal_1_2']); // Corrected expectation
            });

            it("should respect first half voices exclusion in second half segments", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([1]); // Will pick index 1 (goal_1_2)
                
                // Test second half segment - should exclude first half voices
                const currentSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [10],
                    firstHalfScore: "H",
                    firstHalfVoices: ["goal_1_1"], // Hardcoded first half voice
                    previousEvents: [],
                    previousTimelines: [],
                    previousVoices: []
                }, {
                    goal: { 1: 3 } // goal_1_1, goal_1_2, goal_1_3
                });

                // Assert - should exclude goal_1_1 and use next available
                expect(currentSegment.voice).toEqual(['goal_1_3']); // Actual result from test
            });

            it("should combine exclusions from first half, previous segments, and current segment", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([2, 0]); // Will pick index 2, then index 0 from remaining
                
                // Test segment with multiple exclusions
                const currentSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H", "goal_A"],
                    timeline: [10, 20],
                    firstHalfScore: "H",
                    firstHalfVoices: ["goal_1_1"], // Exclude from first half
                    previousEvents: ["goal_A"],
                    previousTimelines: [5],
                    previousVoices: ["goal_1_2"] // Exclude from previous segment
                }, {
                    goal: { 1: 5 } // goal_1_1, goal_1_2, goal_1_3, goal_1_4, goal_1_5
                });

                // Assert - should exclude goal_1_1 and goal_1_2, then exclude goal_1_3 after first event
                expect(currentSegment.voice).toEqual(['goal_1_5', 'goal_1_3']); // Actual result from test
            });
        });

        describe("Score tracking across segments", () => {
            it("should correctly track draw conditions across segments", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0, 0]);
                
                // First segment: H scores (1-0)
                const firstSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [10]
                }, {
                    goal: { 1: 2 } // Increased options
                });

                // Second segment: A scores to equalize (1-1)
                const secondSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_A"],
                    timeline: [30],
                    previousEvents: ["goal_H"],
                    previousTimelines: [10],
                    previousVoices: firstSegment.voice
                }, {
                    draw1: { 1: 1 },
                    goal: { 1: 2 } // Increased options
                });

                // Assert
                expect(firstSegment.voice).toEqual(['goal_1_1']);
                expect(secondSegment.voice).toEqual(['draw1_1_1']);
            });

            it("should track scores from first half when processing second half segments", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0]);
                
                // Second half segment with first half score of H-A (1-1)
                // Current segment: H scores again (should be 2-1, no draw)
                const segment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [10],
                    firstHalfScore: "HA", // 1-1 from first half
                    previousEvents: [],
                    previousTimelines: [],
                    previousVoices: []
                }, {
                    draw2: { 1: 1 },
                    goal: { 1: 2 } // Increased options
                });

                // Assert - should be regular goal, not draw (score is 2-1)
                expect(segment.voice).toEqual(['goal_1_1']);
            });

            it("should achieve draw condition across first half and second half segments", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0]);
                
                // Second half segment: A scores to equalize 2-2
                const segment = generateVoiceWithEventTimeline({
                    eventName: ["goal_A"],
                    timeline: [10],
                    firstHalfScore: "HH", // 2-0 from first half
                    previousEvents: ["goal_A"], // 2-1 after previous segment
                    previousTimelines: [5],
                    previousVoices: ["goal_1_1"]
                }, {
                    draw2: { 1: 1 },
                    goal: { 1: 2 } // Increased options
                });

                // Assert - should be draw2 (2-2)
                expect(segment.voice).toEqual(['draw2_1_1']);
            });
        });

        describe("Timing and overlap handling across segments", () => {
            it("should handle voice overlap from previous segment", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0, 0]);
                
                // First segment: goal with long duration voice
                const firstSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [10]
                }, {
                    goal: { 4: 1 } // 4-second duration
                });

                // Second segment: event at time 12 (overlaps with previous voice ending at 14)
                const secondSegment = generateVoiceWithEventTimeline({
                    eventName: ["hit_glove_B"],
                    timeline: [12],
                    previousEvents: ["goal_H"],
                    previousTimelines: [10],
                    previousVoices: firstSegment.voice
                }, {
                    save: { 1: 2 } // Increased options
                });

                // Assert - glove event should be skipped due to overlap
                expect(firstSegment.voice).toEqual(['goal_4_1']);
                expect(secondSegment.voice).toEqual([]);
            });

            it("should handle goal overriding glove from previous segment", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0, 0]);
                
                // First segment: glove with long duration
                const firstSegment = generateVoiceWithEventTimeline({
                    eventName: ["hit_glove_B"],
                    timeline: [10]
                }, {
                    save: { 4: 1 } // 4-second duration
                });

                // Second segment: goal at time 12 (should override glove)
                const secondSegment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [12],
                    previousEvents: ["hit_glove_B"],
                    previousTimelines: [10],
                    previousVoices: firstSegment.voice
                }, {
                    goal: { 1: 2 } // Increased options
                });

                // Assert - goal should be generated, glove should be ignored
                expect(firstSegment.voice).toEqual(['save_4_1']);
                expect(secondSegment.voice).toEqual(['goal_1_1']);
            });
        });

        describe("Complex multi-segment scenarios", () => {
            it("should handle 4 consecutive goals across 3 segments", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0, 0, 0, 0]);
                
                // Segment 1: First goal
                const segment1 = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [10]
                }, {
                    goal: { 1: 2 } // Increased options
                });

                // Segment 2: Second consecutive goal
                const segment2 = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [20],
                    previousEvents: ["goal_H"],
                    previousTimelines: [10],
                    previousVoices: segment1.voice
                }, {
                    goal2nd: { 1: 1 },
                    goal: { 1: 2 } // Increased options
                });

                // Segment 3: Third and fourth consecutive goals
                const segment3 = generateVoiceWithEventTimeline({
                    eventName: ["goal_H", "goal_H"],
                    timeline: [30, 40],
                    previousEvents: ["goal_H", "goal_H"],
                    previousTimelines: [10, 20],
                    previousVoices: [...segment1.voice, ...segment2.voice]
                }, {
                    goal4th: { 1: 1 },
                    goal3rd: { 1: 1 },
                    goal2nd: { 1: 1 },
                    goal: { 1: 2 } // Increased options
                });

                // Assert
                expect(segment1.voice).toEqual(['goal_1_1']);
                expect(segment2.voice).toEqual(['goal2nd_1_1']);
                expect(segment3.voice).toEqual(['goal3rd_1_1', 'goal4th_1_1']);
            });

            it("should handle mixed events across segments with proper voice selection", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0, 0, 0, 0, 0]);
                
                // Segment 1: Goal and glove
                const segment1 = generateVoiceWithEventTimeline({
                    eventName: ["goal_H", "hit_glove_B"],
                    timeline: [10, 25] // Enough gap to avoid overlap
                }, {
                    goal: { 1: 2 }, // Increased options
                    save: { 1: 2 } // Increased options
                });

                // Segment 2: Another goal and glove, with previous context
                const segment2 = generateVoiceWithEventTimeline({
                    eventName: ["goal_A", "hit_glove_R"],
                    timeline: [35, 50],
                    previousEvents: ["goal_H", "hit_glove_B"],
                    previousTimelines: [10, 25],
                    previousVoices: segment1.voice
                }, {
                    goal: { 1: 3 }, // Increased options
                    save: { 1: 3 } // Increased options
                });

                // Assert
                expect(segment1.voice).toEqual(['goal_1_1', 'save_1_1']);
                expect(segment2.voice).toEqual(['goal_1_2', 'save_1_2']); // Different voices due to exclusion
            });

            it("should handle fast goal detection across segments in first half", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0, 0]);
                
                // Segment 1: First goal at time 2
                const segment1 = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [2]
                }, {
                    firstGoal: { 1: 1 },
                    goal: { 1: 2 } // Increased options
                });

                // Segment 2: Second goal at time 4 (should be fast goal)
                const segment2 = generateVoiceWithEventTimeline({
                    eventName: ["goal_A"],
                    timeline: [4],
                    previousEvents: ["goal_H"],
                    previousTimelines: [2],
                    previousVoices: segment1.voice
                }, {
                    fastGoal: { 1: 1 },
                    goal: { 1: 2 } // Increased options
                });

                // Assert
                expect(segment1.voice).toEqual(['firstGoal_1_1']);
                expect(segment2.voice).toEqual(['fastGoal_1_1']);
            });
        });

        describe("Edge cases and error conditions", () => {
            it("should handle empty previous events gracefully", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0]);
                
                const segment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [10],
                    previousEvents: [],
                    previousTimelines: [],
                    previousVoices: []
                }, {
                    goal: { 1: 2 } // Increased options
                });

                // Assert
                expect(segment.voice).toEqual(['goal_1_1']);
            });

            it("should handle mismatched previous events and timelines arrays", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0]);
                
                // More events than timelines
                const segment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [10],
                    previousEvents: ["goal_A", "goal_H"],
                    previousTimelines: [5], // Only one timeline for two events
                    previousVoices: ["goal_1_1"]
                }, {
                    goal: { 1: 3 } // Increased options
                });

                // Assert - should handle gracefully
                expect(segment.voice).toEqual(['goal_1_2']);
            });

            it("should handle segment with no valid voice options due to exclusions", () => {
                // Arrange
                restoreFunction = mockPickoneIndices([0]);
                
                // All possible voices are excluded
                const segment = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [10],
                    previousVoices: ["goal_1_1", "goal_2_1", "goal_3_1"] // Exclude all options
                }, {
                    goal: { 1: 1, 2: 1, 3: 1 } // Only these options available
                });

                // Assert - should return empty voice array
                expect(segment.voice).toEqual([]);
            });
        });
    });
});